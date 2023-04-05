const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const device = require("express-device");
const config = require("./config");
const mongoose = require("mongoose");
const { requestHandler } = require("./src/middlewares/RequestHandler");
const { verifyFormat } = require("./src/middlewares/BodyFormatVerifier");
const { Logger, Kafka } = require("common");
const cors = require("cors");
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const { socketHandler } = require("./src/services/SocketHandler");

Logger.create(config.logger.config, true);
Logger.info("staring...");

async function initServer() {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(cors(config.cors));
  app.use(verifyFormat);
  app.use(device.capture());
  await Kafka.create(
    config,
    true,
    null,
    {
      serviceName: config.clusterId,
      nodeId: config.nodeId,
    },
    config.kafkaProducerOptions,
    {},
    config.kafkaConsumerOptions,
    {}
  );
  app.use(requestHandler);
  mongoose.set("strictQuery", false);
  mongoose
    .connect(config.mongo.url, config.mongo.options)
    .then(() => Logger.info("connected to mongo!"));
  io.on("connection", (client) => {
    client.on("event", (data) => {});
    client.on("disconnect", () => {});
  });
  server.listen(config.port, async () => {
    try {
      socketHandler(io);
    }
    catch(e) {
      throw e;
    }
  });
}

module.exports = {
  initServer,
};
