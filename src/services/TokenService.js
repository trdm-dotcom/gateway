const { Errors, Utils } = require('common');
const { getKey, generateToken } = require('../utils/Utils');

async function refreshAccessToken(req, res) {
  // const invalidParams = new Errors.InvalidParameterError();
  // Utils.validate(req.client_id, 'client_id').setRequire().throwValid(invalidParams);
  // Utils.validate(req.client_secret, 'client_secret').setRequire().throwValid(invalidParams);
  // Utils.validate(req.grant_type, 'grant_type').setRequire().throwValid(invalidParams);
  // invalidParams.throwErr();
  let payload = req.body;
  let key = getKey(config.key.jwt.privateKey);
  let token = generateToken(payload, key, 3600);
  return res.status(200).send({ accessToken: token });
}

async function revokeToken(req, res) {}

module.exports = {
  refreshAccessToken,
  revokeToken,
};
