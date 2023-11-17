const { Errors, Utils, Logger } = require('common');
const { generateJwtToken } = require('../utils/Utils');
const config = require('../config');
const uuid = require('uuid');
const moment = require('moment');
const { RefreshTokeModel } = require('../model/schema/RefreshTokenSchema');
const { getKey } = require('../utils/Utils');

async function refreshAccessToken(req, res) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['refresh_token'], 'refresh_token').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['client_secret'], 'client_secret').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['grant_type'], 'grant_type').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  if (req.body['client_secret'] != config.login.clientSecret) {
    throw new Errors.GeneralError('INVALID_CLIENT_SECRET');
  }
  const rf = await RefreshTokeModel.findOne({
    token: req.body['refresh_token'],
  });
  if (!rf) {
    throw new Errors.TokenExpiredError();
  }
  const expiredAt = moment(rf.expiredAt);
  if (moment().isAfter(expiredAt)) {
    throw new Errors.TokenExpiredError();
  }
  const accessTokenData = {
    rId: rf._id,
    uId: rf.userId,
    ud: rf.extendData.ud,
    gt: rf.extendData.gt,
    appV: rf.extendData.appV,
  };
  const accExpiredTime = moment().add(config.accessToken.expiredInSeconds, 'second').valueOf();
  const prvKey = getKey(config.key.jwt.privateKey);
  const token = generateJwtToken(accessTokenData, prvKey);
  return res.status(200).send({ accessToken: token, accExpiredTime: accExpiredTime });
}

async function revokeToken(req, res) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['refresh_token'], 'refresh_token').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  RefreshTokeModel.findOneAndRemove({
    token: req.body['refresh_token'],
  });
  return res.status(200).send({});
}

async function generateToken(grantType, userId, refreshTokenTtl, userData, sourceIp, deviceType, appVersion) {
  const accessTokenData = {
    gt: grantType,
    uId: userId,
    ud: {
      username: userData.username,
      id: userData.id,
      name: userData.name,
      status: userData.status,
    },
    appV: appVersion,
  };
  Logger.info(`generate token ${JSON.stringify(accessTokenData)}`);
  const refreshToken = await createRefreshToken(userId, refreshTokenTtl, sourceIp, deviceType, accessTokenData);
  accessTokenData.rId = refreshToken.id;
  const prvKey = getKey(config.key.jwt.privateKey);
  const accessToken = generateJwtToken(accessTokenData, prvKey);
  Logger.warn('generated token ', accessTokenData.rId, refreshToken.token, accessToken);
  return {
    accessToken,
    accessTokenData,
    refreshToken: refreshToken.token,
  };
}

async function createRefreshToken(userId, refreshTokenTtl, sourceIp, deviceType, accessTokenData) {
  const refreshTokenEntity = await RefreshTokeModel.create({
    token: uuid.v4(),
    userId: userId,
    sourceIp: sourceIp,
    deviceType: deviceType,
    extendData: {
      ud: accessTokenData.ud,
      gt: accessTokenData.gt,
    },
    expiredAt: refreshTokenTtl,
  });
  Logger.info(`create refresh token result ${JSON.stringify(refreshTokenEntity)}`);
  return refreshTokenEntity;
}

module.exports = {
  refreshAccessToken,
  revokeToken,
  generateToken,
};
