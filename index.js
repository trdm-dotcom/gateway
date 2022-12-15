const { initServer } = require("./server");
const { init } = require("./src/services/ScopeService");
const config = require("./config");
const { Logger } = require("common");

async function run() {
  await initServer();
  await init();
}

run()
  .then()
  .catch((error) => {
    Logger.error(error);
    process.exit(1);
  });
