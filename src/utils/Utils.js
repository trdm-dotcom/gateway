const fs = require('fs');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const acceptLanguage = require('accept-language');
const config = require('../../config');
const i18n = require('i18next');
acceptLanguage.languages(['en', 'vi']);
const uuid = require('uuid');
const scopeService = require('../services/ScopeService');
const { Logger } = require('common');

const MULTI_ENCRYPTION_PART_PREFIX = 'mutipart';

function rsaEncrypt(data, pathPublicKey) {
  let key = getKey(pathPublicKey);
  try {
    return encrypt(data, key);
  } catch (error) {
    if (error.message != null && error.message.indexOf('data too large for key size') >= 0) {
      let encryption = MULTI_ENCRYPTION_PART_PREFIX;
      let index = 0;
      while (index < data.length) {
        const part = data.substr(index, Math.min(100, data.length - index));
        encryption += `.${encrypt(part, key)}`;
        index += 100;
      }
      return encryption;
    }
    throw error;
  }
}

function encrypt(data, key) {
  let buffer = Buffer.from(data);
  let encrypt = crypto.publicEncrypt({ key: key, padding: 1 }, buffer);
  return encrypt.toString('base64');
}

function rsaDecrypt(data, pathPrivateKey) {
  let key = getKey(pathPrivateKey);
  if (data.startsWith(`${MULTI_ENCRYPTION_PART_PREFIX}`)) {
    const parts = data.split('.');
    let result = '';
    for (let i = 1; i < parts.length; i++) {
      result += decrypt(parts[i], key);
    }
    return result;
  } else {
    return decrypt(data, key);
  }
}

function decrypt(data, key) {
  let buffer = Buffer.from(data, 'base64');
  let decrypt = crypto.privateDecrypt({ key: key, padding: 1 }, buffer);
  return decrypt.toString('utf-8');
}

function getKey(filename) {
  return fs.readFileSync(filename);
}

function generateJwtToken(payload, key, expiredInSeconds) {
  return jwt.sign(payload, key, {
    header: {
      kid: uuid.v4(),
    },
    expiresIn: expiredInSeconds || config.accessToken.expiredInSeconds,
    algorithm: 'RS256',
  });
}

function getLanguageCode(code) {
  try {
    return acceptLanguage.get(code);
  } catch (e) {
    return 'vi';
  }
}

function convertToken(token) {
  if (token == null) {
    return null;
  }

  return {
    userData: undefinedOr(token.ud),
    refreshTokenId: undefinedOr(token.rId),
    grantType: undefinedOr(token.gt),
    userId: undefinedOr(token.uId),
    appVersion: undefinedOr(token.appV),
  };
}

function undefinedOr(data) {
  if (data == null) {
    return undefined;
  }
  return data;
}

function getI18nInstance() {
  return i18n;
}

function checkIfValidIPV6(str) {
  const regexExp =
    /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/gi;
  return regexExp.test(str);
}

function buildDataRequest(uri, req, res, languageCode, token) {
  let [scope, matcher] = scopeService.findScope(uri, false);
  if (scope == null) {
    Logger.warn('not found any private scope', uri);
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
          Logger.error('lack of param', req.path, scope.processedPattern, scope.uriPattern, matcher);
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
  const ip = getSourceIp(req);
  if (ip != null) {
    if (!checkIfValidIPV6(ip)) {
      body.sourceIp = ip.replace(/^.*:/, '');
    }
    body.sourceIp = ip;
  }
  body.deviceType = req.device.type;
  let forward = {
    uri: scope.forwardData.uri,
    topic: scope.forwardData.service.toLowerCase(),
  };
  return [body, forward];
}

function returnCode(res, status, code) {
  res.status(status).send({ code, message: i18n.t(code) });
}

function getSourceIp(req) {
  return first([
    first(req.headers['tx-source-ip']),
    first(req.headers['x-forwarded-for']),
    first(req.connection.remoteAddress),
  ]);
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

module.exports = {
  rsaEncrypt,
  rsaDecrypt,
  getKey,
  getLanguageCode,
  convertToken,
  generateJwtToken,
  getI18nInstance,
  returnCode,
  buildDataRequest,
  def,
  first,
  getSourceIp,
};
