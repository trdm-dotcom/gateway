const { Logger } = require('common');
const config = require('../../config');
var messageId = 0;
const prefix = `${new Date().getTime()}-${config.clusterId}-realtime`;

function getMessageId() {
  messageId++;
  return `${prefix}-${messageId}`;
}

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    socket.on('request', async (data) => {
      let responseMsg;
      try {
        responseMsg = await Kafka.getInstance().sendRequestAsync(getMessageId(), 'realtime', '', data);
        data = Kafka.getResponse(responseMsg);
      } catch (ex) {
        Logger.error(ex);
      }
    });
    socket.on('disconnect', () => {
      Logger.info('A user disconnected');
    });
  });
};

module.exports = {
  socketHandler,
};
