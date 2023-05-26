const { Errors, Kafka, Utils } = require('common');
const { buildDataRequest } = require('../utils/Utils');
const config = require('../../config');
const moment = require('moment');
const { generateToken } = require('./TokenService');

const GrantType = {
  PASSWORD: 'password',
  SOCIAL: 'social',
  BIOMETRIC: 'biometric',
};

async function authentication(messageId, req, res, uri, languageCode) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['grant_type'], 'grant_type').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['client_secret'], 'client_secret').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  if (req.body['client_secret'] !== config.login.clientSecret) {
    throw new Errors.GeneralError('INVALID_CLIENT_SECRET');
  }
  switch (req.body['grant_type']) {
    case GrantType.PASSWORD:
      return await password(messageId, req, res, uri, languageCode);
    case GrantType.SOCIAL:
      return await social(messageId, req, res, uri, languageCode);
    case GrantType.BIOMETRIC:
      return await biometric(messageId, req, res, uri, languageCode);
    default:
      throw new Errors.GeneralError('NO_GRANT_TYPE');
  }
}

async function password(messageId, req, res, uri, languageCode) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['username'], 'username').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['password'], 'password').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  req.body['username'] = req.body['username'].trim();
  return await loginDirectToService(messageId, uri, req, res, languageCode);
}

async function social(messageId, req, res, languageCode) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['socialToken'], 'socialToken').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['socialType'], 'socialType').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  return await loginDirectToService(messageId, uri, req, res, languageCode);
}

async function biometric(messageId, req, res, uri, languageCode) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['username'], 'username').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['signatureValue'], 'publicKey').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  req.body['username'] = req.body['username'].trim();
  return await loginDirectToService(messageId, uri, req, res, languageCode);
}

function createILoginRes(result, userInfo, refExpiredTime, accExpiredTime) {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    userInfo,
    accExpiredTime,
    refExpiredTime,
  };
}

async function loginDirectToService(messageId, uri, req, res, languageCode) {
  let [loginData, forward] = buildDataRequest(uri, req, res, languageCode);
  let msg = await Kafka.getInstance().sendRequestAsync(
    messageId,
    forward.topic,
    forward.uri,
    loginData,
    config.timeout
  );
  let userData = await Kafka.getResponse(msg);
  let refExpiredTime = moment()
    .add(
      req.body['remember'] ? config.refreshToken.expiredInSecondsWithRememberMe : config.refreshToken.expiredInSeconds,
      'second'
    )
    .valueOf();
  let accExpiredTime = moment().add(config.accessToken.expiredInSeconds, 'second').valueOf();
  let result = await generateToken(
    req.body['grant_type'],
    userData.id,
    refExpiredTime,
    accExpiredTime,
    userData,
    loginData.sourceIp,
    loginData.deviceType,
    req.body['app_version']
  );
  let response = createILoginRes(result, userData, refExpiredTime, accExpiredTime);
  res.status(200).send(response);
}

module.exports = authentication;
