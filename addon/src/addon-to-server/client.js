const { io } = require('socket.io-client');
const { config } = require('../config-home-assistant');
const logger = require('../logger');
const { proxyWsMessage } = require('../addon-to-homeassistant/ws-proxy');
const { proxyHttpRequest } = require('../addon-to-homeassistant/http-proxy');

/**
 * @type {import("socket.io-client").Socket}
 */
const socketBetweenClientToProxy = io(config.remoteWsUrl, {
  auth: {
    token: config.socketToken,
  },
});

socketBetweenClientToProxy.on("connect", () => {
  logger.info(`[Proxy Connection] socket connected: ${socketBetweenClientToProxy.id}`);
});

function sendWsResponse(data) {
  socketBetweenClientToProxy
    .emit('ws-message', data);
}

function startListening() {
  socketBetweenClientToProxy.onAny(async (event, req, cb) => {
    logEvent(event, req);

    // Cause 400 error
    delete req?.headers?.['x-forwarded-for'];

    let res;

    if (event.startsWith('http-')) {
      res = await proxyHttpRequest(req);
    } else if (event.startsWith('ws-')) {
      proxyWsMessage(event, req);
    } else {
      logger.error('unknown event', { event, data: req });
      res = { message: 'unknown event', error: true };

      // TODO - return here or not
      return;
    }

    cb?.(res);
  });
}

function logEvent(event, req) {
  let mutableReq = { ...req };

  if(Buffer.isBuffer(mutableReq.body)) {
    mutableReq.body = mutableReq.body.toString();
  }

  delete mutableReq.headers;

  logger.debug(mutableReq, `[${event}] got event`);
}

module.exports = {
  sendWsResponse,
  startListening
}
