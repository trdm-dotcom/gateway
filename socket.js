const config = require('./config');
const { Logger, Errors } = require('common');
const { getMessageId } = require('./src/middlewares/RequestHandler');
const { getI18nInstance, def, first, getLanguageCode, checkIfValidIPV6 } = require('./src/utils/Utils');
const { eventForwardData } = require('./src/services/ScopeService');
const i18n = getI18nInstance();
const device = require('device');
const Server = require('socket.io');
const jwt = require('jsonwebtoken');
const { convertToken } = require('./src/utils/Utils');
const TOKEN_PREFIX = 'jwt ';

var io;

function init(server) {
  io = Server(server);
  io.on('connection', socketHandler);
}

function socketHandler(socket) {
  const mapEventForwardData = eventForwardData();
  const authorizationHeader = socket.handshake.headers.authorization;
  if (authorizationHeader == null || !authorizationHeader.startsWith(TOKEN_PREFIX)) {
    Logger.warn('no prefix in authorization header ', socket.id);
    throw new Errors.GeneralError('UNAUTHORIZED');
  }
  const accessToken = authorizationHeader.substr(TOKEN_PREFIX.length).trim();
  try {
    const payload = jwt.verify(accessToken, _jwtPrvKey, { algorithms: 'RS256' });
    socket.decoded = convertToken(payload);
  } catch (error) {
    Logger.warn('unauthorized ', socket.id);
    throw new Errors.GeneralError('UNAUTHORIZED');
  }
  const token = socket.decoded;
  const languageCode = def(first(socket.handshake.headers['accept-language']), 'vi');
  mapEventForwardData.forEach((event) => {
    socket.on(event.eventName.toLowerCase(), async (data) => {
      const body = buildDataRequest(token, data, socket, languageCode);
      const response = await doSendRequest(
        socket.id,
        event.forwardData.service.toLowerCase(),
        event.forwardData.uri,
        body,
        event.eventName.toLowerCase()
      );
      io.to(socket.id).emit(event.eventClient.toLowerCase(), { status: 200, data: response });
    });
  });

  socket.on('disconnect', () => {
    Logger.info(`User disconnect id is ${socket.id}`);
  });
}

async function doSendRequest(socketId, topic, uri, body, eventName) {
  const messageId = getMessageId();
  logMsg = `${messageId} socket ${socketId} event ${eventName} forward request to ${topic}: ${uri}`;
  Logger.info(logMsg);
  let time = process.hrtime();
  let responseMsg;
  try {
    responseMsg = await Kafka.getInstance().sendRequestAsync(messageId, topic, uri, body, config.timeout);
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

function handleError(socket, event, eventClient, error) {
  Logger.error('error on handler request', socket.id, event, error);
  if (error instanceof Errors.GeneralError) {
    let code = error.code;
    let status = config.responseCode[code];
    if (status != null) {
      return io
        .to(socket)
        .emit(eventClient)
        .send({ status: status, ...error.toStatus() });
    } else {
      return io
        .to(socket)
        .emit(eventClient)
        .send({ status: status, ...error.toStatus() });
    }
  } else {
    io.to(socket).emit(eventClient, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: i18n.t('INTERNAL_SERVER_ERROR', { lng: language }),
    });
  }
}

function returnCode(socket, eventClient, status, code) {
  io.to(socket).emit(eventClient, { status: status, message: i18n.t(code) });
}

module.exports = {
  init,
};
