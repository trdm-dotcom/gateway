const fs = require('fs');
const acceptLanguage = require('accept-language');
acceptLanguage.languages(['en', 'vi']);
async function rsaEncrypt(data, pathPublicKey) {
  let key = await getKey(pathPublicKey);
}

async function rsaDecrype(data, pathPrivateKey) {
  let key = await getKey(pathPrivateKey);
}

async function getKey(filename) {
  let key = fs
    .readFileSync(filename)
    .toString()
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace('-----BEGIN ENCRYPTED PRIVATE KEY-----','')
    .replace('-----END ENCRYPTED PRIVATE KEY-----','')
    .replace('\\s', '');
  return key;
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
};
