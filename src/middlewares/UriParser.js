const config = require('../../config');
function parseURI(req, res) {
  req.parsedURI = `${req.method.toLowerCase()}:${config.basePath}`; // tslint:disable-line
}

module.exports = { parseURI };
