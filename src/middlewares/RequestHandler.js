const config = require('../../config');
const scopeService = require('../services/ScopeService');
const { Errors, Logger, Kafka } = require('common');
const { refreshAccessToken, revokeToken } = require('../services/TokenService');
const jwt = require('jsonwebtoken');
const {
  getKey,
  getLanguageCode,
  convertToken,
  getI18nInstance,
  rsaEncrypt,
} = require('../utils/Utils');
const TOKEN_PREFIX = 'jwt ';
const prefix = `${new Date().getTime()}-${config.clusterId}`;
const i18n = getI18nInstance();
var messageId = 0;

function getMessageId() {
  messageId++;
  return `${prefix}-${messageId}`;
}

function requestHandler(req, res, next) {
  let messageId = getMessageId();
  let languageCode = def(first(req.headers['accept-language']), 'vi');
  doRequestHandler(messageId, req, res, languageCode).catch((error) =>
    handleError(languageCode, error, req, res)
  );
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
          body[field] = rsaEncrypt(body[field], config.key.rsa.privateKey);
        }
      });
    }
  }
  switch (uri) {
    case '/post/api/v1/login':
    case '/post/api/v1/socialLogin':
    case '/post/api/v1/register':
      return await doSendRequest(
        messageId,
        null,
        req,
        res,
        {
          topic: 'user',
          uri,
        },
        req.body
      );
    case '/post/api/v1/refreshToken':
      return await refreshAccessToken(req, res);
    case '/post/api/v1/revokeToken':
      return await revokeToken(req, res);
    case '/post/api/v1/otp':
    case '/post/api/v1/otp/verify':
      return await doSendRequest(
        messageId,
        null,
        req,
        res,
        {
          topic: 'otp',
          uri,
        },
        req.body
      );
    default:
      return await checkToken(messageId, languageCode, uri, req, res);
  }
}

async function checkToken(messageId, languageCode, uri, req, res) {
  let accessToken = req.headers.authorization;
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
    let key = getKey(config.key.jwt.privateKey);
    payload = jwt.verify(accessToken, key, { algorithms: 'RS256' });
  } catch {
    Logger.warn(messageId, 'unauthorized ', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  let token = convertToken(accessToken);
  let refreshTokenId = payload.refreshTokenId;
  let [scope, matcher] = scopeService.findScope(uri, true);
  if (scope == null) {
    Logger.warn(messageId, refreshTokenId, 'not found any private scope', uri);
    return returnCode(res, 404, 'URI_NOT_FOUND');
  }
  var body = req.body;
  Object.keys(req.query).forEach((queryParam) => {
    body[queryParam] = req.query[queryParam];
  });
  if (matcher != null) {
    if (matcher.paramNames != null) {
      for (let i = 0; i < matcher.paramNames.length; i++) {
        if (i < matcher.paramValues.length) {
          body[matcher.paramNames[i]] = matcher.paramValues[i];
        } else {
          Logger.error(
            'lack of param',
            req.path,
            scope.processedPattern,
            scope.uriPattern,
            matcher
          );
        }
      }
    }
  }
  if (body.headers == null) {
    body.headers = {};
  }
  if (token != null) {
    body.headers.token = token;
  }
  body.headers['accept-language'] = getLanguageCode(languageCode);
  let forwardResult = {
    uri: scope.forwardData.uri,
    topic: scope.forwardData.service.toLowerCase(),
  };
  return await doSendRequest(messageId, refreshTokenId, req, res, forwardResult, body);
}

async function doSendRequest(messageId, refreshTokenId, req, res, forwardResult, body) {
  logMsg = `${messageId} rId:${refreshTokenId} forward request ${req.path} to ${forwardResult.topic}:${forwardResult.uri}`;
  Logger.info(logMsg);
  let time = process.hrtime();
  try {
    let responseMsg = await Kafka.getInstance().sendRequestAsync(
      `${new Date().getTime()}-${messageId}`,
      forwardResult.topic,
      forwardResult.uri,
      body,
      config.timeout
    );
    time = process.hrtime(time);
    Logger.warn(`${logMsg} took ${time[0]}.${time[1]} seconds`);
    const data = Kafka.getResponse(responseMsg);
    return res.status(200).send(data);
  } catch (error) {
    time = process.hrtime(time);
    Logger.error(`${logMsg} took ${time[0]}.${time[1]} seconds with error`, e);
    throw e;
  }
}

function def(data, def) {
  if (data == null) {
    return def;
  }
  return data;
}

function first(s) {
  if (s == null) {
    return undefined;
  }
  if (typeof s === 'string') {
    return s;
  }
  if (s.length === 0) {
    return undefined;
  }
  return s.find((i) => i != null);
}

function returnCode(res, status, code) {
  res.status(status).send({ code, message: i18n.t(code) });
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

module.exports = {
  requestHandler,
};
