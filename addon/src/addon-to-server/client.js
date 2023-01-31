const { socketBetweenClientToProxy } = require('./socket');

function sendWsResponse(data) {
  socketBetweenClientToProxy
    .emit('ws-message', data);
}

module.exports = {
  sendWsResponse,
}
