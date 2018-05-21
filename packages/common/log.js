'use strict';
const util = require('util');

/**
 * Constructs JSON to log and logs it
 *
 * @param {string} level - type of log (info, error, debug, warn)
 * @param {string} args - Message to log
 * @param {JSON} additionalKeys - Any additional keys to log, can be null
 * @returns {undefined} - log is printed to stdout, nothing is returned
 */
function log(level, args, additionalKeys) {
  const time = new Date();
  let output = {
    level,
    executions: process.env.EXECUTIONS,
    timestamp: time.toISOString(),
    sender: process.env.SENDER
  };

  output.message = util.format.apply(null, args);

  if (additionalKeys) output = Object.assign({}, additionalKeys, output);

  if (level === 'error') console.error(JSON.stringify(output));
  else console.log(JSON.stringify(output));
}

/**
 * Constructs JSON to log
 *
 * @param {string} additionalKeys - Any additional key value pairs the user chooses to log
 * @param {string} args - Message to log and any other information
 * @returns {undefined} - log is printed to stdout, nothing is returned
 */
function logAdditionalKeys(additionalKeys, ...args) {
  log('info', args, additionalKeys);
}

/**
 * Logs the message
 *
 * @param {string} args - Includes message and any other information to log
 * @returns {undefined} - the JSON to be logged
 */
function info(...args) {
  return log('info', args);
}

/**
 * Logs the error
 *
 * @param {Object} args - Includes error and any other information to log
 * @returns {undefined} - the JSON to be logged
 */
function error(...args) {
  log('error', args);
}

/**
 * Logs the debugger messsages
 *
 * @param {Object} args - Includes debugger message and any other information to log
 * @returns {undefined} - the JSON to be logged
 */
function debug(...args) {
  log('debug', args);
}

/**
 * Logs the Warning messsage
 *
 * @param {Object} args - Includes Warn message and any other information to log
 * @returns {undefined} - the JSON to be logged
 */
function warn(...args) {
  log('warn', args);
}

/**
 * Logs the Fatal messsage
 *
 * @param {Object} args - Includes Fatal message and any other information to log
 * @returns {undefined} - the JSON to be logged
 */
function fatal(...args) {
  log('fatal', args);
}
/**
 * Logs the Trace messsage
 *
 * @param {Object} args - Includes Trace message and any other information to log
 * @returns {undefined} - the JSON to be logged
 */
function trace(...args) {
  log('trace', args);
}

module.exports.info = info;
module.exports.error = error;
module.exports.debug = debug;
module.exports.warn = warn;
module.exports.fatal = fatal;
module.exports.trace = trace;
module.exports.logAdditionalKeys = logAdditionalKeys;