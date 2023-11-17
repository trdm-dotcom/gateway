const { initServer } = require('./server');
const { init } = require('./services/ScopeService');
const { Logger } = require('common');
const { getKey } = require('./utils/Utils');
const config = require('./config');
const { initKafka } = require('./services/KafkaProducerService');

async function run() {
  await initServer();
  await init();
  initKafka();
}

run().catch((error) => {
  Logger.error(error);
});
