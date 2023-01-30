const fs = require('fs');

const logger = require('./logger');
const { deepFreeze } = require('./general');

const CONFIG_FILE = '/data/options.json';

/**
 * @type {{
 *  localHomeAssistantUrl: string,
 *  remoteWsUrl: string,
 *  logLevel: string,
 *  socketToken: string,
 * }}
 */
let config;

try {
  config = JSON.parse((fs.readFileSync(CONFIG_FILE)).toString());
} catch (error) {
  logger.error({ path: CONFIG_FILE, error }, 'Could not parse options file');

  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }

  config = {
    localHomeAssistantUrl: "http://192.168.1.3:8123", // "http://homeassistant.local:8123",
    remoteWsUrl: "ws://192.168.1.10:3000",
    socketToken: "dsaa",
    logLevel: "debug",
  };
}

config.localHomeAssistantUrl = config.localHomeAssistantUrl ?? process.env.LOCAL_HOME_ASSISTANT_URL ?? 'http://homeassistant.local:8123'
config.logLevel = config.logLevel ?? 'info';
config.remoteWsUrl = config.remoteWsUrl ?? process.env.REMOTE_WS_URL ?? 'ws://localhost:3000';
config.socketToken = config.socketToken ?? process.env.SOCKET_TOKEN ?? 'dsaa';

config = deepFreeze(config);

module.exports = {
  config,
}
