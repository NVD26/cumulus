'use strict';

const _get = require('lodash.get');
const schemas = require('../models/schemas');
const handle = require('../lib/response').handle;

function get(event, cb) {
  const schemaName = _get(event.pathParameters, 'schemaName');

  return cb(null, schemas[schemaName]);
}

function handler(event, context) {
  return handle(event, context, true, (cb) => get(event, cb));
}

module.exports = handler;
