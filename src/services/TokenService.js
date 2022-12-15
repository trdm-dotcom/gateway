const { Errors, Utils, Logger } = require("common");
const { getKey, generateJwtToken } = require("../utils/Utils");
const config = require("../../config");
const uuid = require("uuid");
const moment = require("moment");
const { RefreshTokeModel } = require("../model/schema/RefreshTokenSchema");
const mongoose = require('mongoose');

async function refreshAccessToken(req, res) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["refresh_token"], "refresh_token")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["client_secret"], "client_secret")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["grant_type"], "grant_type")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  let rf = await RefreshTokeModel.findOne({
    token: req.body["refresh_token"],
  }).exec();
  if (!rf) {
    throw new Errors.TokenExpiredError();
  }
  let expiredAt = moment(rf.expiredAt);
  if (moment().isAfter(expiredAt)) {
    throw new Errors.TokenExpiredError();
  }
  let accExpiredTime = moment()
    .add(config.accessToken.expiredInSeconds, "s")
    .toDate()
    .getTime();
  let key = getKey(config.key.jwt.privateKey);
  let accessTokenData = {
    rId: rf._id,
    uId: rf.userId,
    ud: rf.extendData.ud,
  };
  let token = generateJwtToken(accessTokenData, key, accExpiredTime);
  return res.status(200).send({ accessToken: token, accExpiredTime });
}

async function revokeToken(req, res) {
  const invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["refresh_token"], "refresh_token")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  let conn = mongoose.connection;
  let session = await conn.startSession();  
  try {
    await session.startTransaction();
    RefreshTokeModel.findOneAndRemove({
      token: req.body["refresh_token"],
    }, {
      session: session
    }); 
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new Errors.GeneralError("INTERNAL_SERVER_ERROR");
  } finally {
    session.endSession();
  }
  return res.status(200).send({});
}

async function generateToken(
  grantType,
  userId,
  refreshTokenTtl,
  accessTokenTtl,
  userData,
  sourceIp,
  deviceType
) {
  let accessTokenData = {
    gt: grantType,
    uId: userId,
    ud: {
      username: userData.username,
      id: userData.id,
    },
  };
  Logger.info("generate token");
  let refreshToken = await createRefreshToken(
    userId,
    refreshTokenTtl,
    sourceIp,
    deviceType,
    accessTokenData
  );
  accessTokenData.rId = refreshToken.id;
  let key = getKey(config.key.jwt.privateKey);
  let accessToken = generateJwtToken(accessTokenData, key, accessTokenTtl);
  Logger.warn(
    "generated token ",
    accessTokenData.rId,
    refreshToken.token,
    accessToken
  );
  return {
    accessToken,
    accessTokenData,
    refreshToken: refreshToken.token,
  };
}

async function createRefreshToken(
  userId,
  refreshTokenTtl,
  sourceIp,
  deviceType,
  accessTokenData
) {
  let refreshTokenEntity = {
    token: uuid.v4(),
    userId: userId,
    sourceIp: sourceIp,
    deviceType: deviceType,
    extendData: {
      ud: accessTokenData.ud,
    },
    expiredAt: moment().add(refreshTokenTtl, "s").toDate(),
  };
  let results = await new Promise((resolve, reject) => {
    let refeshTokenModel = new RefreshTokeModel(refreshTokenEntity);
    refeshTokenModel.save((err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  });
  Logger.info("create refresh token result", results);
  refreshTokenEntity.id = results._id.toString();
  return refreshTokenEntity;
}

module.exports = {
  refreshAccessToken,
  revokeToken,
  generateToken,
};
