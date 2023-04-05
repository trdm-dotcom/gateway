const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema(
  {
    token: String,
    userId: String,
    sourceIp: String,
    deviceType: String,
    expiredAt: Date,
    extendData: Object,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

const RefreshTokeModel = mongoose.model('c_refresh_token', RefreshTokenSchema);

module.exports = {
  RefreshTokeModel,
};
