const { initServer } = require('./server');
const { init } = require('./src/services/ScopeService');
const { Logger } = require('common');
const { getKey } = require('./src/utils/Utils');
const config = require('./config');
const { initKafka } = require('./src/services/KafkaProducerService');

global._jwtPrvKey = getKey(config.key.jwt.privateKey);

async function run() {
  await initServer();
  await init();
  initKafka();
}

run().catch((error) => {
  Logger.error(error);
});
