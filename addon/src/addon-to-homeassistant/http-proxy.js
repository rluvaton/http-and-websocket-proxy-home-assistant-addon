const logger = require('../logger');
const { config } = require('../config-home-assistant');
const { request } = require('undici');

function convertArrayBufferToString(arrayBuffer) {
  return Buffer.from(arrayBuffer.buffer).toString()
}

function parseRequestBody(body, logMeta) {
  if (body === undefined) {
    return body;
  }

  if (typeof body === 'string') {
    return body;
  }

  if(typeof body !== 'object') {
    logger.warn(logMeta, 'body is not of type object or string');
    return body;
  }

  if(Buffer.isBuffer(body)) {
    return body;
  }

  return JSON.stringify(body);
}

async function proxyHttpRequest(req) {
  const contentLengthHeaders = Object.keys(req.headers).filter(header => header.toLowerCase() === 'content-length');

  // Deleting the content length, as it should be recalculated, otherwise the request would time out after a while
  contentLengthHeaders.forEach((header) => {
    delete req.headers[header];
  });

  const { statusCode, headers, body } = await request({
    origin: config.localHomeAssistantUrl,
    path: req.url,
    method: req.method,
    body: parseRequestBody(req.body, req),
    headers: req.headers,
  });

  const bufferBody = await body.arrayBuffer();

  if (statusCode >= 400) {
    logger.error({
      status: statusCode,
      headers: headers,
      response: convertArrayBufferToString(bufferBody),
    }, '[HTTP] Some error in the response');
  } else if (logger.isLevelEnabled('debug')) {
    // Doing this in if even though debug won't log as `convertArrayBufferToString` can be expensive for large strings
    logger.debug('[HTTP] Response was successful', {
      status: statusCode,
      headers: headers,
      data: convertArrayBufferToString(bufferBody),
    });
  }

  return {
    status: statusCode,
    headers: headers,
    data: bufferBody,
  }
}

module.exports = {
  proxyHttpRequest,
}
