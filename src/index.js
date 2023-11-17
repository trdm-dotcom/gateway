const { initServer } = require('./server');
const { init } = require('./services/ScopeService');
const { Logger } = require('common');
const { initKafka } = require('./services/KafkaProducerService');

async function run() {
  await initServer();
  await init();
  initKafka();
}

run().catch((error) => {
  Logger.error(error);
});
