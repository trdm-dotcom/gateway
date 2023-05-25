const { Errors, Utils, Logger } = require('common');
const { getKey, generateJwtToken } = require('../utils/Utils');
const config = require('../../config');
const uuid = require('uuid');
const moment = require('moment');
const { RefreshTokeModel } = require('../model/schema/RefreshTokenSchema');

async function refreshAccessToken(req, res) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['refresh_token'], 'refresh_token').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['client_secret'], 'client_secret').setRequire().throwValid(invalidParams);
  Utils.validate(req.body['grant_type'], 'grant_type').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  if (req.body['client_secret'] != config.login.clientSecret) {
    throw new Errors.GeneralError('INVALID_CLIENT_SECRET');
  }
  let rf = await RefreshTokeModel.findOne({
    token: req.body['refresh_token'],
  });
  if (!rf) {
    throw new Errors.TokenExpiredError();
  }
  let expiredAt = moment(rf.expiredAt);
  if (moment().isAfter(expiredAt)) {
    throw new Errors.TokenExpiredError();
  }
  let accExpiredTime = moment().add(config.accessToken.expiredInSeconds, 's').valueOf();
  let key = getKey(config.key.jwt.privateKey);
  Logger.info(`key length ${key.length}`);
  let accessTokenData = {
    rId: rf._id,
    uId: rf.userId,
    ud: rf.extendData.ud,
    gt: rf.extendData.gt,
    appV: rf.extendData.appV,
  };
  let token = generateJwtToken(accessTokenData, key, accExpiredTime);
  return res.status(200).send({ accessToken: token, accExpiredTime });
}

async function revokeToken(req, res) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body['refresh_token'], 'refresh_token').setRequire().throwValid(invalidParams);
  invalidParams.throwErr();
  RefreshTokeModel.findOneAndRemove({
    token: req.body['refresh_token'],
  });
  return res.status(200).send({});
}

async function generateToken(
  grantType,
  userId,
  refreshTokenTtl,
  accessTokenTtl,
  userData,
  sourceIp,
  deviceType,
  appVersion
) {
  let accessTokenData = {
    gt: grantType,
    uId: userId,
    ud: {
      username: userData.username,
      id: userData.id,
    },
    appV: appVersion,
  };
  Logger.info('generate token');
  let refreshToken = await createRefreshToken(userId, refreshTokenTtl, sourceIp, deviceType, accessTokenData);
  accessTokenData.rId = refreshToken.id;
  let key = getKey(config.key.jwt.privateKey);
  Logger.info(`key length ${key.length}`);
  let accessToken = generateJwtToken(accessTokenData, key, accessTokenTtl);
  Logger.warn('generated token ', accessTokenData.rId, refreshToken.token, accessToken);
  return {
    accessToken,
    accessTokenData,
    refreshToken: refreshToken.token,
  };
}

async function createRefreshToken(userId, refreshTokenTtl, sourceIp, deviceType, accessTokenData) {
  let refreshTokenEntity = await RefreshTokeModel.create({
    token: uuid.v4(),
    userId: userId,
    sourceIp: sourceIp,
    deviceType: deviceType,
    extendData: {
      ud: accessTokenData.ud,
      gt: accessTokenData.gt,
    },
    expiredAt: moment().add(refreshTokenTtl, 's').toDate(),
  });
  Logger.info('create refresh token result', refreshTokenEntity);
  return refreshTokenEntity;
}

module.exports = {
  refreshAccessToken,
  revokeToken,
  generateToken,
};
