const config = require('../../config');
const scopeService = require('../services/ScopeService');

let messageId = 0;
const prefix = `${new Date().getTime()}-${config.clientId}`;

function getMessageId() {
  messageId++;
  return `${prefix}-${messageId}`;
}

function requestHandler(req, res, next) {
  let messageId = getMessageId();
  let languageCode = req.headers['accept-language'] || 'vi';
  doRequestHandler(messageId, req, res, languageCode);
}

async function doRequestHandler(messageId, req, res, languageCode) {
  let uri = `/${req.method.toLowerCase()}${req.path}`;
  if (config.enableDebug) {
    console.log(messageId, 'request', uri);
  }
  if (config.enableEncryptPassword === true) {
    let fieldEncryptArr = config.encryptPassword[uri];
    if (fieldEncryptArr != null) {
      const body = req.body;
      fieldEncryptArr.forEach((field) => {
        if (body[field] != null && typeof body[field] === 'string') {
          body[field] = Utils.rsaEncrypt(body[field], config.rsa.publicKey);
        }
      });
    }
  }
  switch (uri) {
    case '/post/api/v1/login' || '/post/api/v1/socialLogin':
      break;
    case '/post/api/v1/refreshToken':
      break;
    case '/post/api/v1/revokeToken':
      break;
  }

  const [scope, matcher] = scopeService.findScope(uri, true);
  res.status(200).send('success');
}

function doSendRequest(messageId, refreshTokenId, req, res, forwardResult, body) {}

module.exports = {
  requestHandler,
};
