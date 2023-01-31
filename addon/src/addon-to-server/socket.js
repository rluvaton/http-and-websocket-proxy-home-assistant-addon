const { io } = require('socket.io-client');
const { config } = require('../config-home-assistant');

/**
 * @type {import("socket.io-client").Socket}
 */
const socketBetweenClientToProxy = io(config.remoteWsUrl, {
  auth: {
    token: config.socketToken,
  },
});

module.exports = {
  socketBetweenClientToProxy
};
