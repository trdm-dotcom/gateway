require('dotenv').config();
const uuid = require('uuid');

const nodeId = process.env.ENV_NODE_ID ? process.env.ENV_NODE_ID : uuid.v4();
const basePath = '/api/v1';

module.exports = config = {
  cors: {},
  scopes: {
    publicScopeGroups: ['PUBLIC'],
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
  rsa: {
    publicKey: '',
    privateKey: '',
  },
  port: process.env.PORT || 3000,
  timeout: process.env.TIMEOUT || 20000,
  mongo: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/api_gateway',
    options: {},
  },
};
