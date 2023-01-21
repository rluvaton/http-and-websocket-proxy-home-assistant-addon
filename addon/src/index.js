const logger = require('./logger');
const Axios = require('axios');
const { io } = require("socket.io-client");
const { loadConfig } = require('./config-home-assistant');
const WebSocket = require('ws');


/**
 * @type {string}
 */
let localHomeAssistant;

/**
 * @type {AxiosInstance}
 */
let axios;

/**
 * @type {{
 *  localHomeAssistantUrl: string,
 *  remoteWsUrl: string,
 *  logLevel: string,
 *  socketToken: string,
 * }}
 */
let config;

/**
 * @type {Record<string, {socket: WebSocket, open: boolean, authenticated: boolean, buffer: any[]}>}
 */
let wsConnections = {};

/**
 * @type {import("socket.io-client").Socket}
 */
let socketBetweenClientToProxy;

async function run() {
  config = await loadConfig();

  logger.level = config.logLevel ?? 'info';

  localHomeAssistant = config.localHomeAssistantUrl ?? process.env.LOCAL_HOME_ASSISTANT_URL ?? 'http://homeassistant.local:8123'

  const remoteUrl = config.remoteWsUrl ?? process.env.REMOTE_WS_URL ?? 'ws://localhost:3000';

  logger.debug({
    remoteUrl,
    localHomeAssistant,
  })

  logger.info(`Local Home Assistant address: ${localHomeAssistant}`);
  logger.info(`Remote WebSocket URL: ${remoteUrl}`);

  axios = Axios.create({
    baseURL: localHomeAssistant,
  });

  socketBetweenClientToProxy = io(remoteUrl, {
    auth: {
      token: config.socketToken,
    },
  });

  socketBetweenClientToProxy.on("connect", () => {
    logger.info(`socket connected: ${socketBetweenClientToProxy.id}`);
  });

  socketBetweenClientToProxy.onAny(async (event, req, cb) => {
    logger.debug({ event, req }, 'got event');

    // Cause 400 error
    delete req?.headers?.['x-forwarded-for'];

    let res;

    if (event.startsWith('http-')) {
      res = await proxyHttpRequest(req);
    } else if (event.startsWith('ws-')) {
      if(event === 'ws-open' || event === 'ws-close') {
        return;
      }
      sendMessages(req);
    } else {
      logger.error('unknown event', { event, data: req });
      res = { message: 'unknown event', error: true };

      // TODO - return here or not
      return;
    }

    cb?.(res);
  });

  socketBetweenClientToProxy.on('ws-open', async (req, cb) => {
    startListening(req);
  });

  socketBetweenClientToProxy.on('ws-close', async (req, cb) => {
    stopListening(req);
  });
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
    logger.info({ clientId: req.clientId }, 'Already connected');
    return;
  }

  let address = `${localHomeAssistant}${req.url}`;
  if (address.startsWith('http://')) {
    address = address.replace('http://', 'ws://')
  }

  ws.socket = new WebSocket(address);

  ws.socket.on('open', function open() {
    logger.info('WebSocket opened!');

    if (ws.buffer.length) {
      logger.info('Got messages in the buffer');
      try {
        ws.buffer.forEach(item => {
          if (isWsAuthMessage(item)) {
            ws.authenticated = true;
          }

          ws.socket.send(item);
        })
      } catch (e) {
        logger.error(e, 'failed to send message to web socket');
        return false;
      }
    }

    ws.open = true;
    ws.buffer = [];
  });

  ws.socket.on('message', function message(data) {
    logger.debug({ data: data.toString() }, 'received message on WebSocket');

    socketBetweenClientToProxy
      .compress(false)
      .emit('ws-message', data);
  });

  ws.socket.on('close', () => {
    logger.info('WebSocket client closed');

    ws.open = false;
    // TODO - should I terminate it?
    ws.socket = undefined;
    ws.authenticated = false;
  });
}

function sendMessages(req) {
  const ws = wsConnections[req.clientId];

  if (!ws) {
    logger.error({ clientId: req.clientId }, 'Not connected exiting');
    return;
  }

  const messageToSend = req.body.toString();

  if (!ws.open) {
    ws.buffer.push(messageToSend);
    return;
  }

  if (ws.authenticated && isWsAuthMessage(messageToSend)) {
    logger.info('Received auth message why the socket open which means that the server disconnected');

    ws.socket?.terminate();
    ws.socket?.eventNames().forEach(eventName => ws.socket.removeAllListeners(eventName))
    ws.socket = undefined;
    ws.open = undefined;
    ws.authenticated = false;

    startListening(req);

    return;
  }

  logger.info({ messageToSend }, 'send to home assistant');

  ws.socket.send(messageToSend);
}

function proxyHttpRequest(req) {
  return axios.request({
    method: req.method,
    data: req.body,
    headers: req.headers,
    params: req.params,
    url: req.url,
  }).then((res) => {
    logger.debug('Response was successful', {
      status: res.status,
      headers: res.headers,
      data: res.data,
    });
    return {
      status: res.status,
      headers: res.headers,
      data: res.data,
    }
  }).catch((error) => {
    logger.error({
      response: error.response?.data,
      headers: error.response?.headers,
      status: error.response?.status,
      error,
    }, 'Some error in the response');

    return {
      status: error.response?.status,
      headers: error.response?.headers,
      data: error.response?.data,
    }
  })
}

function stopListening(req) {
  let ws = wsConnections[req.clientId];

  if (!ws) {
    logger.info({ requestId: req.requestId }, 'WebSocket already closed');
    return;
  }

  if (!ws.open) {
    logger.info({ requestId: req.requestId }, 'WebSocket already closed');
  }


  ws.socket?.terminate();
  ws.socket?.eventNames().forEach(eventName => ws.socket.removeAllListeners(eventName))
  wsConnections[req.clientId] = undefined;
}


run()
  .catch((error) => {
    logger.error({ error }, 'had an error')
  });
