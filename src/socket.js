const config = require('./config');
const { Logger, Errors } = require('common');
const { getInstance } = require('./services/KafkaProducerService');
const { getMessageId } = require('./middlewares/RequestHandler');
const { getI18nInstance, def, first, getLanguageCode, checkIfValidIPV6 } = require('./utils/Utils');
const { eventForwardData } = require('./services/ScopeService');
const i18n = getI18nInstance();
const device = require('device');
const jwt = require('jsonwebtoken');
const { convertToken } = require('./utils/Utils');
const TOKEN_PREFIX = 'jwt ';
const { Kafka } = require('kafka-common');

function socketHandler(socket) {
  const languageCode = def(first(socket.handshake.headers['accept-language']), 'en');
  eventForwardData().forEach((event) => {
    socket.on(event.eventName.toLowerCase(), (data) => {
      Logger.info(`forward request ${event.forwardData}`);
      forwardRequest(event, data, socket, languageCode).catch((error) => {
        Logger.error('error on handler request', socket.id, event, error);
        handleError(languageCode, socket, event.eventClient.toLowerCase(), error);
      });
    });
  });

  socket.on('disconnect', () => {
    Logger.info(`User disconnect id is ${socket.id}`);
  });
}

async function forwardRequest(event, data, socket, languageCode) {
  const authorizationHeader = data.authorization.token;
  if (authorizationHeader == null || !authorizationHeader.startsWith(TOKEN_PREFIX)) {
    Logger.warn('no prefix in authorization header ', socket.id);
    return returnCode(socket, event.eventClient.toLowerCase(), 401, 'UNAUTHORIZED');
  }
  const accessToken = authorizationHeader.substr(TOKEN_PREFIX.length).trim();
  var payload;
  try {
    const prvKey = getKey(config.key.jwt.privateKey);
    payload = jwt.verify(accessToken, prvKey, { algorithms: 'RS256' });
  } catch (error) {
    Logger.warn('unauthorized ', socket.id);
    return returnCode(socket, event.eventClient.toLowerCase(), 401, 'UNAUTHORIZED');
  }
  delete data.authorization;
  const body = buildDataRequest(convertToken(payload), data, socket, languageCode);
  const response = await doSendRequest(
    socket.id,
    event.forwardData.service.toLowerCase(),
    event.forwardData.uri,
    body,
    event.eventName.toLowerCase()
  );
  if (event.sendTo) {
    _io.to(socket.id).emit(event.eventClient.toLowerCase(), { status: 200, data: response });
  } else {
    _io.emit(event.eventClient.toLowerCase(), { status: 200, data: response });
  }
}

async function doSendRequest(socketId, topic, uri, body, eventName) {
  const messageId = getMessageId();
  logMsg = `${messageId} socket ${socketId} event ${eventName} forward request to ${topic}: ${uri}`;
  Logger.info(logMsg);
  let time = process.hrtime();
  let responseMsg;
  try {
    responseMsg = await getInstance().sendRequestAsync(messageId, topic, uri, body, config.timeout);
  } catch (e) {
    time = process.hrtime(time);
    Logger.error(`${logMsg} took ${time[0]}.${time[1]} seconds with error`, e);
  }
  time = process.hrtime(time);
  Logger.warn(`${logMsg} took ${time[0]}.${time[1]} seconds`);
  return Kafka.getResponse(responseMsg);
}

function buildDataRequest(token, data, socket, languageCode) {
  var body = {
    ...data,
  };
  Object.keys(socket.handshake.query).forEach((queryParam) => {
    body[queryParam] = socket.handshake.query[queryParam];
  });
  if (body.headers == null) {
    body.headers = {};
  }
  if (token != null) {
    body.headers.token = token;
  }
  body.headers['accept-language'] = getLanguageCode(languageCode);
  const ip = getSourceIp(socket);
  if (ip != null) {
    if (!checkIfValidIPV6(ip)) {
      body.sourceIp = ip.replace(/^.*:/, '');
    }
    body.sourceIp = ip;
  }
  body.deviceType = device(socket.request.headers['user-agent']).type;
  return body;
}

function getSourceIp(socket) {
  return first([first(socket.handshake.headers['x-forwarded-for']), first(socket.request.connection.remoteAddress)]);
}

function handleError(language, socket, eventClient, error) {
  if (error instanceof Errors.GeneralError) {
    let code = error.code;
    let status = config.responseCode[code];
    if (status != null) {
      _io.to(socket.id).emit(eventClient, { status: status, ...error.toStatus() });
    } else {
      _io.to(socket.id).emit(eventClient, { status: 400, ...error.toStatus() });
    }
  } else {
    _io.to(socket.id).emit(eventClient, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: i18n.t('INTERNAL_SERVER_ERROR', { lng: language }),
    });
  }
}

function returnCode(socket, eventClient, status, code) {
  console.log('emit', socket.id, eventClient);
  _io.to(socket.id).emit(eventClient, { status: status, message: i18n.t(code) });
}

module.exports = {
  socketHandler,
};
