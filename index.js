const { initServer } = require('./server');
const { init } = require('./src/services/ScopeService');
const { Logger } = require('common');
const { getKey } = require('./src/utils/Utils');
const config = require('./config');

global._jwtPrvKey = getKey(config.key.jwt.privateKey);

async function run() {
  await Promise.all([initServer(), init()]);
}

run().catch((error) => {
  Logger.error(error);
  process.exit(1);
});
