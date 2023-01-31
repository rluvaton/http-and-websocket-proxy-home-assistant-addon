const logger = require('../logger');
const Axios = require('axios');
const { config } = require('../config-home-assistant');

const axios = Axios.create({
  baseURL: config.localHomeAssistantUrl,
});

async function proxyHttpRequest(req) {
  const contentLengthHeaders = Object.keys(req.headers).filter(header => header.toLowerCase() === 'content-length');

  // Deleting the content length, as it should be recalculated, otherwise the request would time out after a while
  contentLengthHeaders.forEach((header) => {
    delete req.headers[header];
  });

  try {
    const response = await axios.request({
      method: req.method,
      data: req.body,
      headers: req.headers,
      params: req.params,
      url: req.url,

      // Setting as array buffer so images and stuff like that so the images won't corrupt from the conversion...
      responseType: 'arraybuffer',
    });

    logger.debug('[HTTP] Response was successful', {
      status: response.status,
      headers: response.headers,
      data: response.data?.toString(),
    });

    return {
      status: response.status,
      headers: response.headers,
      data: response.data,
    }
  } catch (error) {
    let responseData = error.response?.data;

    if (Buffer.isBuffer(responseData)) {
      responseData = responseData.toString();
    }

    logger.error({
      response: responseData,
      headers: error.response?.headers,
      status: error.response?.status,
      error: error?.message,
    }, '[HTTP] Some error in the response');

    return {
      status: error.response?.status,
      headers: error.response?.headers,
      data: error.response?.data,
    }
  }
}

module.exports = {
  proxyHttpRequest,
}
