const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const device = require('express-device');
const config = require('./config');
const dbConnect = require('./src/utils/dbConnect');
const { requestHandler } = require('./src/middlewares/RequestHandler');
const { verifyFormat } = require('./src/middlewares/BodyFormatVerifier');
const { Logger, Kafka } = require('common');
const cors = require('cors');

Logger.create(config.logger.config, true);
Kafka.create(config, {}, true);

async function initServer() {
  app.use('/assets', express.static('assets'));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(cors(config.cors));
  app.use(verifyFormat);
  app.use(device.capture());
  app.use(requestHandler);
  await dbConnect.init();
  Logger.info('connected to mongo!');
  app.listen(config.port, () => {
    Logger.info('Server Start!');
  });
}

module.exports = {
  initServer,
};
