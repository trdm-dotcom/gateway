const { Errors, Kafka, Utils } = require("common");
const { buildDataRequest } = require("../utils/Utils");
const config = require("../../config");
const moment = require("moment");
const { generateToken } = require("./TokenService");
const { biometricLogin } = require("../services/BiometricServices");

const GrantType = {
  PASSWORD: "password",
  SOCIAL_LOGIN: "social_login",
  LOGIN_BIOMETRIC: "biometric",
};

async function authentication(messageId, req, res, uri, languageCode) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["grant_type"], "grant_type")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["client_secret"], "client_secret")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  if(req.body["client_secret"] != config.login.clientSecret){
    throw new Errors.GeneralError("INVALID_CLIENT_SECRET");
  }
  switch (req.body["grant_type"]) {
    case GrantType.PASSWORD:
      return await password(messageId, req, res, uri, languageCode);
    case GrantType.SOCIAL_LOGIN:
      return await social(messageId, req, res, uri, languageCode);
    case GrantType.LOGIN_BIOMETRIC:
      return await biometric(messageId, req, res, uri, languageCode);
    default:
      throw new Errors.GeneralError("NO_GRANT_TYPE");
  }
}

async function password(messageId, req, res, uri, languageCode) {
  let invalidParams = new Utils.InvalidParameterError();
  Utils.validate(req.body["username"], "username")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(request.body["password"], "password")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  req.body["username"] = req.body["username"].trim();
  return await loginDirectToService(messageId, uri, req, res, languageCode);
}

async function social(messageId, req, res, languageCode) {
  let invalidParams = new Utils.InvalidParameterError();
  Utils.validate(req.body["login_social_token"], "login_social_token")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(request.body["login_social_type"], "login_social_type")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  req.body["username"] = req.body["username"].trim();
  return await loginDirectToService(messageId, uri, req, res, languageCode);
}

async function biometric(messageId, req, res, uri, languageCode) {
  await biometricLogin(req);
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
      req.body["remember"]
        ? config.refreshToken.expiredInSecondsWithRememberMe
        : config.refreshToken.expiredInSeconds,
      "second"
    )
    .valueOf();
  let accExpiredTime = moment()
    .add(config.accessToken.expiredInSeconds, "second")
    .valueOf();
  let result = await generateToken(
    req.body["grant_type"],
    userData.id,
    refExpiredTime,
    accExpiredTime,
    userData,
    loginData.sourceIp,
    loginData.deviceType
  );
  let response = createILoginRes(
    result,
    userData,
    refExpiredTime,
    accExpiredTime
  );
  res.status(200).send(response);
}

module.exports = authentication;
