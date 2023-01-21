const fs = require('fs/promises');

const logger = require('../common/logger');
const { deepFreeze } = require('../common/general');

const CONFIG_FILE = '/data/options.json'

let config;

/**
 * This will read the config file
 * @return {Promise<object>}
 */
async function loadConfig() {
  if (!config) {
    try {
      const configStr = (await fs.readFile(CONFIG_FILE)).toString();

      config = deepFreeze(JSON.parse(configStr));
    } catch (error) {
      logger.error({ path: CONFIG_FILE, error }, 'Could not parse options file');

      // TODO - return this
      throw error;
      config = {
        "localHomeAssistantUrl": "http://homeassistant.local:8123",
        "remoteWsUrl": "ws://192.168.1.10:3000",
        "socketToken": "dsaa",
        "logLevel": "debug"
      };

    }
  }

  return config;
}


module.exports = {
  loadConfig,
}
