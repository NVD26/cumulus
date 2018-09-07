'use strict';

const _get = require('lodash.get');
const handle = require('../lib/response').handle;
const { S3, StepFunction } = require('@cumulus/ingest/aws');
const { inTestMode } = require('@cumulus/common/test-utils');

const handle = require('../lib/response').handle;

/**
 * get a single execution status
 *
 * @param {Object} event - aws lambda event object.
 * @param {Function} cb - aws lambda callback function
 * @returns {undefined} undefined
 */
function get(event, cb) {
  const arn = _get(event.pathParameters, 'arn');

  return StepFunction.getExecutionStatus(arn)
    .then((status) => {
      const replace = status.output.replace;
      if (replace) {
        S3.get(replace.Bucket, replace.Key)
          .then((file) => {
            const fullStatus = JSON.parse(file.Body);
            return cb(null, fullStatus);
          }).catch(cb);
      }
      else {
        cb(null, status);
      }
    })
    .catch(cb);
}

/**
 * The main handler for the lambda function
 *
 * @param {Object} event - aws lambda event object.
 * @param {Object} context - aws context object
 * @returns {undefined} undefined
 */
function handler(event, context) {
  return handle(event, context, !inTestMode() /* authCheck */, (cb) => get(event, cb));
}

module.exports = handler;
