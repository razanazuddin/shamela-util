const express = require("express");
const axios = require("axios");
const fs = require("fs");

// metadataRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /listings.
const metadataRoutes = express.Router();

// This will help us connect to the database
const dbo = require("../db/conn");

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

    metaObj._id = metaObj.SortField.split("_")[1];
    metaObj.KitabURL = docUrl;
    return metaObj;
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
    "error-migrate.log",
    `${new Date().toUTCString()}: ${JSON.stringify(error)}\n`,
    "utf-8",
    (err) => {
      if (err) {
        throw err;
      }
    }
  );
};

const kitabMetadata = require("../data/kitab-corpus-metadata.json");

// This section will help you create a new record.
metadataRoutes.route('/migrate').post(function (req, res) {
  const dbConnect = dbo.getDb();

  const kitabSrc = kitabMetadata.map((kitab) => kitab.URL);

  for (let index = 0; index < kitabSrc.length; index++) {
    // setTimeout(() => {
      getDocument(kitabSrc[index])
        .then((contents) => {
            dbConnect
              .collection('metadata')
              .insertOne(contents, function (err, result) {
                if (err) {
                  logError(err);
                } else {
                  console.log(result.insertedId, 'OK ' + index);
                }
              });
            // fs.appendFile('data.log', `${JSON.stringify(contents)}\n`, 'utf-8', err => {
            //   if (err) {
            //     throw err;
            //   }
            // });
          })
        .catch((error) => {
          console.log(kitabSrc[index], error.error);
          logError(`${kitabSrc[index]} ${error.error}`);
        });
      if (index === kitabSrc.length - 1) {
        console.log('End of document reached!');
      }
    // }, index * 50);
  }
  res.status(200).send('Shamela migrated!');
});

// Search book and display metadata
metadataRoutes.route("/search").post(function (req, res) {
  try {
    const { search } = req.body;

    const dbConnect = dbo.getDb();

    dbConnect
      .collection('metadata')
      .aggregate([
        {
          $search: {
            index: 'metadata_index',
            text: {
              query: search,
              path: {
                'wildcard': '*'
              }
            }
          }
        }
      ])
      .limit(100)
      .toArray(function (err, result) {
        if (err) {
          res.status(400).send('Error fetching books!');
        } else {
          res.status(200).json({
            result
          });
        }
      });
  } catch (err) {
    logError(err);
    res.status(400).send(err);
  }
});

module.exports = metadataRoutes;
