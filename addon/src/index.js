const logger = require('./logger');
const { config } = require('./config-home-assistant');

logger.level = config.logLevel;

logger.debug({
  remoteUrl: config.remoteWsUrl,
  localHomeAssistant: config.localHomeAssistantUrl,
})

logger.info(`Local Home Assistant address: ${config.localHomeAssistantUrl}`);
logger.info(`Remote WebSocket URL: ${config.remoteWsUrl}`);

const { startListening } = require('./addon-to-server/listen');
startListening();
