const config = require("../../config");
const { Errors, Utils } = require("common");
const { BiometricModel } = require("../model/schema/BiometricSchema");
const { rsaEncrypt, getSourceIp } = require("../utils/Utils");
const { crypto } = require("crypto");

async function biometricRegister(messageId, req, res) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["username"], "username")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["publicKey"], "publicKey")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["password"], "password")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  req.body["username"] = req.body["username"].trim();
  let results = await BiometricModel.find({
    $and: [{ username: req.body["username"] }, { isDeleted: false }],
  });
  if (results.length > 0) {
    if (results[0].publicKey == request.publicKey) {
      throw new Errors.GeneralError("LOGIN_BIOMETRIC_PUBLIC_KEY_EXISTED");
    }
    Logger.info(
      "already exist biometric register for account, start unactivated this biometric "
    );
    await updateBiometric(results[0], true, "hủy do user đổi device");
    Logger.info("finish update biometric");
  }
  if (config.enableEncryptPassword === true) {
    req.body["password"] = rsaEncrypt(
      req.body["password"],
      config.key.rsa.privateKey
    );
  }
  let bio = await BiometricModel.create({
    password: req.body["password"],
    publicKey: req.body["publicKey"],
    username: req.body["username"].toUpperCase(),
    isDeleted: false,
    status: config.isEnableBiometric ? "ACTIVE" : "INACTIVE",
    biometricType: req.body["biometricType"],
    sourceIp: getSourceIp(req),
  })[0];
  return res.status(200).send({ biometricId: bio._id });
}

async function biometricLogin(req) {
  let invalidParams = new Utils.InvalidParameterError();
  Utils.validate(request.body["username"], "username")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  req.body["username"] = req.body["username"].trim();
  let publicKey = `-----BEGIN PUBLIC KEY-----\n{key}\n-----END PUBLIC KEY-----`;
  const verify = crypto.createVerify("RSA-SHA256");
  let results = await BiometricModel.find({
    $and: [{ username: req.body["username"] }, { isDeleted: false }],
  });
  if (results == null || results.length == 0) {
    throw new Errors.GeneralError("LOGIN_BIOMETRIC_NOT_FOUND");
  }
  if (results[0].status == "INACTIVE") {
    await updateBiometric(results[0], true, "huỷ do user không xác thực OTP");
    throw new Errors.GeneralError("LOGIN_BIOMETRIC_OTP_DOES_NOT_VERIFIED");
  }
  publicKey = publicKey.replace(/{key}/g, results[0].publicKey);
  verify.update(req.body["username"].toUpperCase());
  const signature =
    req.body["signatureValue"] == null || req.body["signatureValue"] == ""
      ? req.body["password"]
      : req.body["signatureValue"];
  if (signature == null || signature == "") {
    throw new Errors.InvalidParameterError("INVALID_SIGNAGURE");
  }
  if (!verify.verify(publicKey, signature, "base64")) {
    throw new Errors.GeneralError(
      "LOGIN_BIOMETRIC_SIGNATURE_VERIFICATION_FAILED"
    );
  }
}

async function queryBiometricStatus(req, res) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["username"], "username")
    .setRequire()
    .throwValid(invalidParams);
  Utils.validate(req.body["publicKey"], "publicKey")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  req.body["username"] = req.body["username"].trim();
  let results = await BiometricModel.find({
    $and: [
      { username: req.body["username"] },
      { isDeleted: false },
      { publicKey: req.body["publicKey"] },
    ],
  });
  return res.status(200).send({ isEnable: results.length == 1 });
}

async function cancelBiometricRegister(req, res) {
  let invalidParams = new Errors.InvalidParameterError();
  Utils.validate(req.body["username"], "username")
    .setRequire()
    .throwValid(invalidParams);
  invalidParams.throwErr();
  req.body["username"] = req.body["username"].trim();
  let results = await BiometricModel.find({
    $and: [{ username: req.body["username"] }, { isDeleted: false }],
  });
  if (results == null || results.length == 0) {
    throw new Errors.GeneralError("LOGIN_BIOMETRIC_NOT_FOUND");
  }
  await updateBiometric(results[0], true, "hủy do user");
  return res.status(200).send({});
}

async function updateBiometric(result, status, reason) {
  await BiometricModel.findByIdAndUpdate(result._id, {
    isDeleted: status,
    deleteReason:
      result == "INACTIVE" ? "huỷ do user không xác thực OTP" : reason,
  });
}

module.exports = {
  biometricRegister,
  queryBiometricStatus,
  cancelBiometricRegister,
  biometricLogin,
};
