const { initServer } = require("./server");
const { init } = require("./src/services/ScopeService");
const config = require("./config");
const { Logger } = require("common");
const cron = require("node-cron");
const taskCleanRefreshToken = require("./src/job/TaskCleanRefreshToken");

async function run() {
  await initServer();
  await init();
}

cron.schedule("0 * * * * *", taskCleanRefreshToken);

run()
  .then()
  .catch((error) => {
    Logger.error(error);
    process.exit(1);
  });
