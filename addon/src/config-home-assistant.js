const fs = require('fs');

const logger = require('./logger');
const { deepFreeze } = require('./general');

const CONFIG_FILE = '/data/options.json'

let config;

try {
  config = JSON.parse((fs.readFileSync(CONFIG_FILE)).toString());
} catch (error) {
  logger.error({ path: CONFIG_FILE, error }, 'Could not parse options file');

  process.exit(1);
}

config.localHomeAssistantUrl = config.localHomeAssistantUrl ?? process.env.LOCAL_HOME_ASSISTANT_URL ?? 'http://homeassistant.local:8123'
config.logLevel = config.logLevel ?? 'info';
config.remoteWsUrl = config.remoteWsUrl ?? process.env.REMOTE_WS_URL ?? 'ws://localhost:3000';

config = deepFreeze(config);

module.exports = {
  config,
}
