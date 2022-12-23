// Loads the configuration from .env to process.env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
// get MongoDB driver connection
const dbo = require('./db/conn');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());
// app.use(require('./api/book'));
// app.use(require('./api/metadata'));

// Global error handling
app.use(function (err, _req, res) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get("/", (req, res) => {
  res.send("Express on Vercel");
});

// perform a database connection when the server starts
dbo.connectToServer(function (err) {
  if (err) {
    console.error(err);
    process.exit();
  }

  // start the Express server
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
});

// Export the Express API
module.exports = app;