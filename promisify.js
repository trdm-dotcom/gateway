const util = require('util');
const fs = require('fs');

const fsStat = util.promisify(fs.stat);
const fsReadFile = util.promisify(fs.readFile);
const fsWriteFile = util.promisify(fs.writeFile);

module.exports = {
  fsStat,
  fsReadFile,
  fsWriteFile,
};
