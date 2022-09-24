const { Errors, Kafka, Utils } = require("common");
const { buildDataRequest } = require("../utils/Utils");
const config = require("../../config");
const moment = require("moment");
const { generateToken } = require("./TokenService");

const GrantType = {
  PASSWORD: "password",
  SOCIAL_LOGIN: "social_login",
};

async function authentication(messageId, req, res, uri, languageCode) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["grant_type"], "grant_type")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  switch (req.body["grant_type"]) {
    case GrantType.PASSWORD:
      return await password(messageId, req, res, uri, languageCode);
    case GrantType.SOCIAL_LOGIN:
      return await social(messageId, req, res);
  }
  throw new Errors.GeneralError("NO_GRANT_TYPE");
}

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
    .add(
      req.body["remember"]
        ? config.refreshToken.expiredInSecondsWithRememberMe
        : config.refreshToken.expiredInSeconds,
      "second"
    )
    .toDate()
    .getTime();
  let accExpiredTime = moment()
    .add(config.accessToken.expiredInSeconds, "second")
    .toDate()
    .getTime();
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

async function social(messageId, req, res) {
  let invalidParams = new Utils.InvalidParameterError();
  Logger.info("login loginSocial");
  Utils.validate(req.body["login_social_token"], "login_social_token")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(request.body["login_social_type"], "login_social_type")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  if (req.body["username"] != null) {
    req.body["username"] = req.body["username"].trim();
  }
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
    .toDate()
    .getTime();
  let accExpiredTime = moment()
    .add(config.accessToken.expiredInSeconds, "second")
    .toDate()
    .getTime();
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
