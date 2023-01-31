const logger = require('../logger');
const WebSocket = require('ws');
const { config } = require('../config-home-assistant');
const { sendWsResponse } = require('../addon-to-server/client');

/**
 * @type {Record<string, {socket: WebSocket, open: boolean, authenticated: boolean, buffer: any[]}>}
 */
let wsConnections = {};

function proxyWsMessage(event, req) {
  switch (event) {
    case 'ws-open':
      startListening(req);
      break;

    case 'ws-close':
      stopListening(req);
      break;

    default:
      sendMessages(req);
      break;
  }
}

function isWsAuthMessage(message) {
  try {
    const messageAsJson = JSON.parse(message);

    // If first time auth and already had connection it's mean we
    // disconnected and need to restart the socket
    if (messageAsJson.type === 'auth') {
      return true;
    }
  } catch (e) {
    // Ignore...
  }
  return false;
}

function startListening(req) {
  logger.info({ requestId: req.requestId }, '[WebSocket] Starting Listening');
  let ws = wsConnections[req.clientId];

  if (!ws) {
    wsConnections[req.clientId] = {
      buffer: [],
      socket: undefined,
      open: false,
      authenticated: false,
    };

    ws = wsConnections[req.clientId];
  }

  if (ws.socket) {
    logger.info({ clientId: req.clientId }, '[WebSocket] Already connected');
    return;
  }

  let address = `${config.localHomeAssistantUrl}${req.url || ''}`;
  if (address.startsWith('http://')) {
    address = address.replace('http://', 'ws://')
  }

  ws.socket = new WebSocket(address);

  ws.socket.on('open', function open() {
    logger.info('[WebSocket] WebSocket opened!');

    if (ws.buffer.length) {
      logger.info('[WebSocket] Got messages in the buffer');
      try {
        ws.buffer.forEach(item => {
          if (isWsAuthMessage(item)) {
            ws.authenticated = true;
          }

          ws.socket.send(item);
        })
      } catch (e) {
        logger.error(e, '[WebSocket] failed to send message to web socket');
        return false;
      }
    }

    ws.open = true;
    ws.buffer = [];
  });

  ws.socket.on('message', function message(data) {
    logger.debug({ data: data.toString() }, '[WebSocket] received message');

    sendWsResponse(data);
  });

  ws.socket.on('close', () => {
    logger.info('[WebSocket] client closed');

    ws.open = false;
    // TODO - should I terminate it?
    ws.socket = undefined;
    ws.authenticated = false;
  });
}

function sendMessages(req) {
  logger.info({ requestId: req.requestId }, '[WebSocket] Send message');

  let ws = wsConnections[req.clientId];

  if (!ws) {
    logger.error({ clientId: req.clientId }, '[WebSocket] Not connected, connecting...');
    startListening(req);
    ws = wsConnections[req.clientId];
  }

  const messageToSend = req.body.toString();

  // Until connecting add to buffer so as soon the WebSocket connected we can send it's data
  if (!ws.open) {
    ws.buffer.push(messageToSend);
    return;
  }

  if (ws.authenticated && isWsAuthMessage(messageToSend)) {
    logger.info('[WebSocket] Received auth message why the socket open which means that the server disconnected');

    ws.socket?.terminate();
    ws.socket?.eventNames().forEach(eventName => ws.socket.removeAllListeners(eventName))
    ws.socket = undefined;
    ws.open = undefined;
    ws.authenticated = false;

    startListening(req);

    return;
  }

  logger.info({ messageToSend }, '[WebSocket] send to HomeAssistant');

  ws.socket.send(messageToSend);
}

function stopListening(req) {
  logger.info({ requestId: req.requestId }, '[WebSocket] Stop Listening');

  let ws = wsConnections[req.clientId];

  if (!ws) {
    logger.info({ requestId: req.requestId }, '[WebSocket] not exist');
    return;
  }

  if (!ws.open) {
    logger.info({ requestId: req.requestId }, '[WebSocket] already closed');
  }

  ws.socket?.terminate();
  ws.socket?.eventNames().forEach(eventName => ws.socket.removeAllListeners(eventName))
  wsConnections[req.clientId] = undefined;

  logger.info({ requestId: req.requestId }, '[WebSocket] closed');
}


module.exports = {
  proxyWsMessage,
}
