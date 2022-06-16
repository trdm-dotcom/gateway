const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const config = require('./config');
const connection = require('./src/db/connection');
const { requestHandler } = require('./src/middlewares/RequestHandler');

async function initServer() {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(requestHandler);
  await connection.init();
  app.listen(config.port, () => {
    console.log('Server Start!');
  });
}

module.exports = {
  initServer,
};
