const { initServer } = require('./server');
const { init } = require('./src/services/ScopeService');
const { Logger } = require('common');

async function run() {
  await Promise.all([initServer(), init()]);
}

run().catch((error) => {
  Logger.error(error);
  process.exit(1);
});
