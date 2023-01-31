const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BiometricSchema = new Schema(
  {
    password: String,
    publicKey: String,
    username: String,
    isDeleted: Boolean,
    deleteReason: String,
    biometricType: String,
    status: String,
    sourceIp: String,
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const BiometricModel = mongoose.model("c_biometric", BiometricSchema);

module.exports = {
    BiometricModel,
};
