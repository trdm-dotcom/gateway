const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const device = require('express-device');
const config = require('./config');
const mongoose = require('mongoose');
const { requestHandler } = require('./src/middlewares/RequestHandler');
const { verifyFormat } = require('./src/middlewares/BodyFormatVerifier');
const { Logger } = require('common');
const cors = require('cors');
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: config.cors,
});
const { socketHandler } = require('./socket');
const { RedisService } = require('./src/services/RedisService');

Logger.create(config.logger.config, true);
Logger.info('staring...');
global._io = io;

async function initServer() {
  mongoose.connect(config.mongo.url, config.mongo.options).then(() => Logger.info('connected to mongo!'));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(cors(config.cors));
  app.use(verifyFormat);
  app.use(device.capture());
  app.use(requestHandler);
  _io.on('connection', socketHandler);
  new RedisService().initPubSub(config.pubsub.channel.chat);
  http.listen(config.port, () => {
    Logger.info('Server Start!');
  });
}

module.exports = {
  initServer,
};
