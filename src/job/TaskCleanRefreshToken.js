const { RefreshTokeModel } = require("../model/schema/RefreshTokenSchema");
const mongoose = require("mongoose");
const { Logger } = require("common");

async function taskCleanRefreshToken() {
  Logger.info("clean refresh token");
    let conn = mongoose.connection;
    let session = await conn.startSession();
    try {
      await session.startTransaction();
      RefreshTokeModel.deleteMany(
        {
          expiredAt: { $lt: new Date() },
        },
        {
          session: session,
        }
      );
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
    } finally {
      session.endSession();
    }
}

module.exports = taskCleanRefreshToken;
