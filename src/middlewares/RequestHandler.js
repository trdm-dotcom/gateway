const config = require('../../config');
const scopeService = require('../services/ScopeService');
const jwt = require('jsonwebtoken');
const {
  getKey,
  getLanguageCode,
  convertToken,
  generateToken,
  rsaDecrype,
} = require('../utils/Utils');
const TOKEN_PREFIX = 'jwt ';
const prefix = `${new Date().getTime()}-${config.clientId}`;

let messageId = 0;

function getMessageId() {
  messageId++;
  return `${prefix}-${messageId}`;
}

function requestHandler(req, res, next) {
  let messageId = getMessageId();
  let languageCode = def(first(first(req.headers['accept-language']), 'vi'));
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
          body[field] = rsaDecrype(body[field], config.key.rsa.privateKey);
        }
      });
    }
  }
  switch (uri) {
    case '/post/api/v1/login' || '/post/api/v1/socialLogin':
      return null;
    case '/post/api/v1/refreshToken':
      let payload = req.body;
      let key = getKey(config.key.jwt.privateKey);
      let token = generateToken(payload, key, 3600);
      return res.status(200).send({ accessToken: token });
    case '/post/api/v1/revokeToken':
      return null;
  }
  return checkToken(messageId, languageCode, uri, req, res);
}

async function checkToken(messageId, languageCode, uri, req, res) {
  let accessToken = req.headers.authorization;
  if (accessToken == null || !accessToken.startsWith(TOKEN_PREFIX)) {
    console.warn(messageId, 'no prefix in authorization header', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  if (accessToken.length === 0) {
    console.warn(messageId, 'access token length 0', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  accessToken = accessToken.substr(TOKEN_PREFIX.length).trim();
  var payload;
  try {
    let key = getKey(config.key.jwt.privateKey);
    payload = jwt.verify(accessToken, key, { algorithms: 'RS256' });
  } catch {
    console.warn(messageId, 'unauthorized ', uri);
    return returnCode(res, 401, 'UNAUTHORIZED');
  }
  let token = convertToken(accessToken);
  let refreshTokenId = payload.refreshTokenId;
  let [scope, matcher] = scopeService.findScope(uri, true);
  if (scope == null) {
    console.warn(messageId, refreshTokenId, 'not found any private scope', uri);
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
          console.error(
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
  let ip = first([
    first(req.headers['tx-source-ip']),
    first(req.headers['x-forwarded-for']),
    first(req.connection.remoteAddress),
  ]);
  if (ip != null) {
    if (!checkIfValidIPV6(ip)) {
      body.sourceIp = ip.replace(/^.*:/, '');
    }
    body.sourceIp = ip;
  }
  body.deviceType = req.device.type;
  let forwardResult = {
    uri: scope.forwardData.uri,
    topic: scope.forwardData.service,
  };
  return doSendRequest(messageId, refreshTokenId, req, res, forwardResult, body);
}

function doSendRequest(messageId, refreshTokenId, req, res, forwardResult, body) {
  logMsg = `${messageId} rId:${refreshTokenId} forward request ${req.path} to ${forwardResult.topic}:${forwardResult.uri}`;
  console.log(logMsg);
  let time = process.hrtime();
  try {
  } catch (error) {
    time = process.hrtime(time);
    console.error(`${logMsg} took ${time[0]}.${time[1]} seconds with error`, e);
  }
  time = process.hrtime(time);
  console.warn(`${logMsg} took ${time[0]}.${time[1]} seconds`);
  let data = null;
  res.status(200).send(data);
}

function checkIfValidIPV6(ip) {
  const regex =
    /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/;
  return regex.test(ip);
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
  res.status(status).send({ code, message: code });
}

module.exports = {
  requestHandler,
};
