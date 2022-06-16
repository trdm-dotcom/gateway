const server = require('./server');
const { init } = require('./src/services/ScopeService');

async function run() {
  await server.initServer();
  await init();
}

run();
