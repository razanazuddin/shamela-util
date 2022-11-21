const express = require('express');
const axios = require('axios');
const fs = require("fs");

// bookRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /listings.
const bookRoutes = express.Router();

// This will help us connect to the database
const dbo = require('../db/conn');

const getDocument = async (docUrl) => {
  try {
    const response = await axios.get(docUrl);
    const contents = response.data.split(/\r?\n/);

    let metaObj = {};
    contents
      .filter((line) => line.includes("#META# "))
      .forEach((meta) => {
        const data = meta.split("\t:: ");
        const key = data[0].split(".")[1];
        const value = data[1];
        Object.assign(metaObj, { [key]: value });
      });

    const metaEnd = contents.findIndex((line) =>
      line.includes("#META#Header#End#")
    );
    const contentArr = contents.slice(metaEnd + 1).filter((n) => n);

    return {
      _id: metaObj.SortField.split("_")[1],
      metadata: metaObj,
      content: contentArr
    };

  } catch (err) {
    return {
      status: err.response.status,
      statusText: err.response.statusText,
      error: err.response.data,
    };
  }
};

const logError = (error) => {
  fs.appendFile(
    "error-book.log",
    `${new Date().toUTCString()}: ${JSON.stringify(error)}\n`,
    "utf-8",
    (err) => {
      if (err) {
        throw err;
      }
    }
  );
};

// This section will help you get a list of all the records.
bookRoutes.route('/books/:bookId').get(async function (req, res) {
  const { bookId } = req.params;

  const dbConnect = dbo.getDb();

  dbConnect
      .collection('metadata')
      .aggregate([
        {
          $match: {
            _id: bookId
          }
        }
      ])
      .limit(1)
      .toArray((err, result) => {
        if (err) {
          res.status(400).send('Error fetching book!');
        } else {
          const book = result[0];
          getDocument(book.KitabURL)
            .then((contents) => {
              res.status(200).json({
                result: contents
              });
            })
            .catch((error) => {
              logError(error);
              res.status(400).send('Error fetching content!');
            });
        }
      });
});

module.exports = bookRoutes;