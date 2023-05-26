require('dotenv').config();
const uuid = require('uuid');
const { Utils } = require('common');

const nodeId = process.env.ENV_NODE_ID ? process.env.ENV_NODE_ID : uuid.v4();
const basePath = '/api/v1';
let config = {
  clusterId: 'gateway',
  clientId: `gateway-${nodeId}`,
  nodeId: nodeId,
  kafkaUrls: Utils.getEnvArr('ENV_KAFKA_URLS', ['localhost:9092']),
  kafkaCommonOptions: {},
  kafkaConsumerOptions: {},
  kafkaProducerOptions: {},
  kafkaTopicOptions: {},
  requestHandlerTopics: [],
  basePath: basePath,
  cors: {},
  scopes: {
    publicScopeGroups: ['PUBLIC'],
  },
  logger: {
    config: {
      appenders: {
        application: { type: 'console' },
        file: {
          type: 'file',
          filename: './../logs/gateway/application.log',
          compression: true,
          maxLogSize: 104857600,
          backups: 10,
        },
      },
      categories: {
        default: { appenders: ['application', 'file'], level: 'info' },
      },
    },
  },
  responseCode: {
    TOKEN_EXPIRED: 401,
    UNAUTHORIZED: 403,
    URI_NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    REQUEST_TIMEOUT: 504,
    SERVICE_DOWN: 500,
  },
  enableEncryptPassword: true,
  encryptPassword: {
    '/post/api/v1/login': ['password'],
    '/post/api/v1/register': ['password'],
    '/post/api/v1/user/resetPassword': ['newPassword'],
    '/post/api/v1/user/changePassword': ['oldPassword', 'newPassword'],
    '/post/api/v1/user/confirm': ['password'],
  },
  fileDir: {
    scope: 'src/data/scopeData.json',
  },
  key: {
    jwt: {
      publicKey: './../external/key/jwt_public.key',
      privateKey: './../external/key/jwt_private.key',
    },
    rsa: {
      publicKey: './../external/key/rsa_public.key',
      privateKey: './../external/key/rsa_private.key',
    },
    aes: {
      key: 'IaPON8rXjCQ5TIUVYBtcw8WKGCfcQEtc',
      iv: 'jI4j7fqHWO',
      keyHash: 'wfyxb3sR1O',
    },
  },
  port: 3000,
  timeout: 20000,
  mongo: {
    url: `mongodb://${Utils.getEnvStr('ENV_MONGO_HOST', 'localhost')}:${Utils.getEnvStr(
      'ENV_MONGO_PORT',
      '27017'
    )}/gateway`,
    options: {},
  },
  accessToken: {
    expiredInSeconds: 900,
    issuer: 'Homer',
  },
  refreshToken: {
    expiredInSeconds: 86400,
    expiredInSecondsWithRememberMe: 2592000,
  },
  hash: {
    headers: 'hommer',
  },
  isEnableBiometric: true,
  login: {
    clientSecret: 'iW4rurIrZJ',
  },
};

config.kafkaConsumerOptions = {
  ...(config.kafkaCommonOptions ? config.kafkaCommonOptions : {}),
  ...(config.kafkaConsumerOptions ? config.kafkaConsumerOptions : {}),
};
config.kafkaProducerOptions = {
  ...(config.kafkaCommonOptions ? config.kafkaCommonOptions : {}),
  ...(config.kafkaProducerOptions ? config.kafkaProducerOptions : {}),
};

if (config.requestHandlerTopics.length == 0) {
  config.requestHandlerTopics.push(config.clusterId);
}

module.exports = config;
