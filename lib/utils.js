/*** Node modules ***/
const httpStatusCodes = require('http-status-codes');

/*** Utility object ***/
const utils = {};

/**
 * @function createHttpResponse
 *
 * Function to create a structured http response object
 *
 * @param {Number} code
 *    Http status code
 *
 * @param {(Object|Array)} data
 *    The data Object/Array to set as response data
 *
 * @returns {Object} Returns the generated http response object
 *
**/
utils.createHttpResponse = (code, data=undefined) => {
  let res = {
    statusCode: code,
    message: httpStatusCodes.getStatusText(code),
    data: data
  };

  return res;
};

/*** Export the utility object ***/
module.exports = utils;
