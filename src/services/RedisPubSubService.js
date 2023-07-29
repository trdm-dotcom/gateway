const config = require('../../config');
const { createClient } = require('redis');

const DATA_TYPE = {
  UNDEFINED: 'a',
  NULL: 'b',
  BOOLEAN: '0',
  STRING: '1',
  NUMBER: '2',
  DATE: '3',
  OBJECT: '4',
};

const RedisPubSubService = class RedisPubSubService {
  constructor() {
    this.client = createClient(config.redis);
  }

  async initPubSub(channel, callback) {
    try {
      await this.client.connect();
      await this.client.subscribe(channel, (message) => {
        callback(this.convertBackFormatDataRedis(message));
      });
    } catch (error) {
      Logger.error(error);
    }
  }
  
  convertBackFormatDataRedis(data) {
    const type = data[0];
    let content = null;
    switch (type) {
      case DATA_TYPE.UNDEFINED:
        return undefined;
      case DATA_TYPE.NULL:
        return null;
      case DATA_TYPE.DATE:
        content = data.substring(1);
        return new Date(Number(content));
      case DATA_TYPE.BOOLEAN:
        content = data.substring(1);
        return content == '1';
      case DATA_TYPE.NUMBER:
        content = data.substring(1);
        return content;
      case DATA_TYPE.STRING:
        content = data.substring(1);
        return content;
      default:
        content = data.substring(1);
        return JSON.parse(content, this.receiver);
    }
  }
  receiver(key, value) {
    const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (typeof value == 'string' && dateFormat.test(value)) {
      return new Date(value);
    }
    return value;
  }
};

module.exports = {
  RedisPubSubService,
};
