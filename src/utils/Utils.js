const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const acceptLanguage = require('accept-language');
const config = require('../../config');
const forwardType = require('../constraint/ForwardType');
acceptLanguage.languages(['en', 'vi']);

const MULTI_ENCRYPTION_PART_PREFIX = '';

async function rsaEncrypt(data, pathPublicKey) {
  try {
    let key = getKey(pathPublicKey);
    return encrypt(data, key);
  } catch (error) {
    if (e.message != null && e.message.indexOf('data too large for key size') >= 0) {
      let encryption = MULTI_ENCRYPTION_PART_PREFIX;
      let index = 0;
      while (index < data.length) {
        const part = data.substr(index, Math.min(100, data.length - index));
        encryption += `.${rsaEncryptShort(part, publicKey)}`;
        index += 100;
      }
      return encryption;
    }
    throw e;
  }
}

function encrypt(data, key) {
  let buffer = Buffer.from(data);
  let encrypt = crypto.publicEncrypt({ key: key, padding: 1 }, buffer);
  return encrypt.toString('base64');
}

async function rsaDecrype(data, pathPrivateKey) {
  let key = getKey(pathPrivateKey);
  if (data.startsWith(`${MULTI_ENCRYPTION_PART_PREFIX}`)) {
    const parts = data.split('.');
    let result = '';
    for (let i = 1; i < parts.length; i++) {
      result += rsaDecryptShort(parts[i], privateKey);
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

function generateToken(payload, key, expiredInSeconds) {
  return jwt.sign(payload, key, {
    expiresIn: expiredInSeconds || config.accessToken.expiredInSeconds,
    algorithm: 'RS256',
  });
}

function getLanguageCode(code) {
  acceptLanguage.get(code);
}

function convertToken(token) {
  if (token == null) {
    return null;
  }

  return {
    userData: undefinedOr(token.ud),
    clientId: undefinedOr(token.cId),
    loginMethod: undefinedOr(token.lm),
    refreshTokenId: undefinedOr(token.rId),
    userId: undefinedOr(token.uId),
  };
}

function undefinedOr(data) {
  if (data == null) {
    return undefined;
  }
  return data;
}

module.exports = {
  rsaEncrypt,
  rsaDecrype,
  getKey,
  getLanguageCode,
  convertToken,
  generateToken,
};
