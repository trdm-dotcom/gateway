const { Errors, Kafka, Utils } = require("common");
const { buildDataRequest} = require("../utils/Utils");
const config = require("../../config");
const moment = require('moment');
const { generateToken } = require('./TokenService');

const GrantType = {
  PASSWORD: "password",
  ACCESS_GOOGLE: "access_google",
  ACCESS_FACEBOOK: "access_facebook",
  LOGIN_BIOMETRIC: "biometric",
  SOCIAL_LOGIN: "social_login",
};

function authentication(messageId, req, res, uri, languageCode) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["client_secret"], "client_secret")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["grant_type"], "grant_type")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  let grantType = req.body["grant_type"];
  switch (grantType) {
    case GrantType.PASSWORD:
      return password(messageId, req, res, uri, languageCode);
    case GrantType.ACCESS_FACEBOOK:
      return facebook(messageId, req, res);
    case GrantType.ACCESS_GOOGLE:
      return google(messageId, req, res);
    case GrantType.LOGIN_BIOMETRIC:
      return biometric(messageId, req, res);
    case GrantType.SOCIAL_LOGIN:
      return social(messageId, req, res);
  }
  throw new Errors.GeneralError("NO_GRANT_TYPE");
}

function google(messageId, req, res) {}

function facebook(messageId, req, res) {}

async function password(messageId, req, res, uri, languageCode) {
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
    .add(86400, "second")
    .toDate()
    .getTime();
  let accExpiredTime = moment()
    .add(360, "second")
    .toDate()
    .getTime();
  let result = await generateToken(req.body["grant_type"], userData.id, refExpiredTime, accExpiredTime, userData, loginData.sourceIp, loginData.deviceType);
  let response = createILoginRes(result, userData, refExpiredTime, accExpiredTime);
  res.status(200).send(response);
}

function biometric(messageId, req, res) {}

function social(messageId, req, res) {}

function createILoginRes(result, userInfo, refExpiredTime, accExpiredTime) {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    userInfo,
    accExpiredTime,
    refExpiredTime, 
  };
}

module.exports = authentication;
