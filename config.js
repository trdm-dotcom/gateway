require('dotenv').config();
const uuid = require('uuid');

const nodeId = process.env.ENV_NODE_ID ? process.env.ENV_NODE_ID : uuid.v4();
const basePath = '/api/v1';
module.exports = config = {
  clusterId: 'api-gateway',
  clientId: nodeId,
  kafkaUrls: ['localhost:9092'],
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
          filename: 'logs/application.log',
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
    '/post/api/v1/user/login': ['password'],
    '/post/api/v1/user/register': ['password'],
    '/post/api/v1/user/resetPassword': ['password'],
    '/post/api/v1/user/changePassword': ['oldpass', 'newpass'],
  },
  fileDir: {
    scope: 'src/data/scopeData.json',
  },
  key: {
    jwt: {
      publicKey: 'external/key/access_token_public.key',
      privateKey: 'external/key/access_token_private.key',
    },
    rsa: {
      publicKey: 'external/key/rsa_public.key',
      privateKey: 'external/key/rsa_private.key',
    },
  },
  port: 3000,
  timeout: 20000,
  mongo: {
    url: 'mongodb://localhost:27017/api_gateway',
    options: {},
  },
  accessToken: {
    expiredInSeconds: 86400,
    issuer: 'app',
  },
};
