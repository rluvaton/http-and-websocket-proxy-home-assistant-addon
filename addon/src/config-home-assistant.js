const fs = require('fs/promises');

const logger = require('./logger');
const { deepFreeze } = require('./general');

const CONFIG_FILE = '/data/options.json'

let config;

/**
 * This will read the config file
 * @return {Promise<object>}
 */
async function loadConfig() {
  if (!config) {
    try {
      config = JSON.parse((await fs.readFile(CONFIG_FILE)).toString());
    } catch (error) {
      logger.error({ path: CONFIG_FILE, error }, 'Could not parse options file');

      throw error;
    }

    config = deepFreeze(setDefaults(config));
  }

  return config;
}

function setDefaults(configObj) {
  configObj.localHomeAssistantUrl = configObj.localHomeAssistantUrl ?? process.env.LOCAL_HOME_ASSISTANT_URL ?? 'http://homeassistant.local:8123'
  configObj.logLevel = configObj.logLevel ?? 'info';
  configObj.remoteWsUrl = configObj.remoteWsUrl ?? process.env.REMOTE_WS_URL ?? 'ws://localhost:3000';

  return configObj;
}


module.exports = {
  loadConfig,
}
