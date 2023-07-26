const config = require('../../config');
const { createClient } = require('redis');

const RedisService = class RedisService {
  constructor() {
    this.client = createClient(config.redis);
  }

  initPubSub(channel) {
    this.client.on('message', (message) => {
      const { serverId, type, data } = JSON.parse(message);
      if (serverId !== config.clientId) {
        return;
      }
      _io.emit(type, { status: 200, message: data });
    });
    this.client.subscribe(channel);
  }
};

module.exports = {
  RedisService,
};
