const { Kafka } = require('kafka-common');
const config = require('../../config');

var instance;

function initKafka() {
  instance = new Kafka.KafkaRequestSender(config, true, null);
}

function getInstance() {
  return instance;
}

module.exports = {
  getInstance,
  initKafka,
};
