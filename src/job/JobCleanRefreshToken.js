const cron = require("node-cron");

const taskCleanRefreshToken = cron.schedule(
  "0 * * * *",
  () => {
    console.log("running a task every minute");
  },
  {
    scheduled: false,
  }
);

module.exports = {
  taskCleanRefreshToken,
};
