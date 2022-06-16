const mongoose = require('mongoose');
const config = require('../../config');

function init() {
  return new Promise(async (resolve, reject) => {
    try {
      await mongoose.connect(config.mongo.url, config.mongo.options);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  init,
};
