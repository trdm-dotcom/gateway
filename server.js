const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const device = require('express-device');
const config = require('./config');
const connection = require('./src/db/connection');
const { requestHandler } = require('./src/middlewares/RequestHandler');
const { Logger } = require('common');

async function initServer() {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(device.capture());
  app.use(requestHandler);
  await connection.init();
  app.listen(config.port, () => {
    Logger.info('Server Start!');
  });
}

module.exports = {
  initServer,
};
