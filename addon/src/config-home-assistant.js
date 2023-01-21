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
      const configStr = (await fs.readFile(CONFIG_FILE)).toString();

      config = deepFreeze(JSON.parse(configStr));
    } catch (error) {
      logger.error({ path: CONFIG_FILE, error }, 'Could not parse options file');

      throw error;
    }
  }

  return config;
}


module.exports = {
  loadConfig,
}
