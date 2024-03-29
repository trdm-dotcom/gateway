const config = require('../config');
const { Errors, Logger } = require('common');
const { getInstance } = require('../services/KafkaProducerService');
const { refreshAccessToken, revokeToken } = require('../services/TokenService');
const jwt = require('jsonwebtoken');
const {
  convertToken,
  getI18nInstance,
  rsaEncrypt,
  returnCode,
  buildDataRequest,
  def,
  first,
  getKey,
} = require('../utils/Utils');
const authentication = require('./../services/AuthenticationService');
const TOKEN_PREFIX = 'jwt ';
const prefix = `${new Date().getTime()}-${config.clusterId}`;
const i18n = getI18nInstance();
const { Kafka } = require('kafka-common');
var messageId = 0;

function getMessageId() {
  messageId++;
  return `${prefix}-${messageId}`;
}

function requestHandler(req, res, next) {
  const messageId = getMessageId();
  const languageCode = def(first(req.headers['accept-language']), 'en');
  doRequestHandler(messageId, req, res, languageCode).catch((e) => handleError(languageCode, e, req, res));
}

async function doRequestHandler(messageId, req, res, languageCode) {
  let uri = `/${req.method.toLowerCase()}${req.path}`;
  if (config.enableDebug) {
    Logger.info(messageId, 'request', uri);
  }
  if (config.enableEncryptPassword === true) {
    let fieldEncryptArr = config.encryptPassword[uri];
    if (fieldEncryptArr != null) {
      const body = req.body;
      fieldEncryptArr.forEach((field) => {
        if (body[field] != null && typeof body[field] === 'string') {
          body[field] = rsaEncrypt(body[field], config.key.rsa.publicKey);
        }
      });
    }
  }
  switch (uri) {
    case '/post/api/v1/login':
    case '/post/api/v1/login/social':
    case '/post/api/v1/login/biometric':
      return await authentication(messageId, req, res, uri, languageCode);
    case '/post/api/v1/register':
    case '/post/api/v1/otp':
    case '/post/api/v1/otp/verify':
    case '/post/api/v1/user/checkExist':
    case '/post/api/v1/user/resetPassword':
      return await forwardRequest(messageId, req, res, uri, languageCode);
    case '/post/api/v1/refreshToken':
      return await refreshAccessToken(req, res);
    case '/post/api/v1/revokeToken':
      return await revokeToken(req, res);
    default:
      return await checkToken(messageId, languageCode, uri, req, res);
  }
}

async function checkToken(messageId, languageCode, uri, req, res) {
  var accessToken = req.headers.authorization;
  if (accessToken == null || !accessToken.startsWith(TOKEN_PREFIX)) {
    Logger.warn(messageId, 'no prefix in authorization header', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  if (accessToken.length === 0) {
    Logger.warn(messageId, 'access token length 0', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  accessToken = accessToken.substr(TOKEN_PREFIX.length).trim();
  var payload;
  try {
    const prvKey = getKey(config.key.jwt.privateKey);
    payload = jwt.verify(accessToken, prvKey, { algorithms: 'RS256' });
  } catch {
    Logger.warn(messageId, 'unauthorized ', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  await forwardRequest(messageId, req, res, uri, languageCode, convertToken(payload));
}

function handleError(language, error, req, res) {
  Logger.error('error on handler request', req.path, req.method, error);
  if (error instanceof Errors.GeneralError) {
    let code = error.code;
    let status = config.responseCode[code];
    if (status != null) {
      return res.status(status).send(error.toStatus());
    } else {
      return res.status(400).send(error.toStatus());
    }
  } else {
    return res.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      message: i18n.t('INTERNAL_SERVER_ERROR', { lng: language }),
    });
  }
}

async function forwardRequest(messageId, req, res, uri, languageCode, token) {
  [body, forward] = buildDataRequest(uri, req, res, languageCode, token);
  await doSendRequest(messageId, req, res, forward, body);
}

async function doSendRequest(messageId, req, res, forward, body) {
  logMsg = `${messageId} forward request ${req.path} to ${forward.topic}: ${forward.uri}`;
  Logger.info(logMsg);
  let time = process.hrtime();
  let responseMsg;
  try {
    responseMsg = await getInstance().sendRequestAsync(messageId, forward.topic, forward.uri, body, config.timeout);
  } catch (e) {
    time = process.hrtime(time);
    Logger.error(`${logMsg} took ${time[0]}.${time[1]} seconds with error`, e);
  }
  time = process.hrtime(time);
  Logger.warn(`${logMsg} took ${time[0]}.${time[1]} seconds`);
  let data = Kafka.getResponse(responseMsg);
  res.status(200).send(data);
  return null;
}

module.exports = {
  getMessageId,
  requestHandler,
};
