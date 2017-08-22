'use strict';

const get = require('lodash.get');
const AWS = require('aws-sdk');
const aws = require('@cumulus/ingest/aws');
const consumer = require('@cumulus/ingest/consumer');

async function dispatch(message) {
  const sfPayload = message.Body;

  const stepfunctions = new AWS.StepFunctions();
  const params = {
    stateMachineArn: sfPayload.ingest_meta.state_machine,
    input: JSON.stringify(sfPayload)
  };

  if (sfPayload.ingest_meta.execution_name) {
    params.name = sfPayload.ingest_meta.execution_name;
  }

  return stepfunctions.startExecution(params).promise();
}

function queue(event, context, cb) {
  const template = get(event, 'template');
  const provider = get(event, 'provider');
  const meta = get(event, 'meta');
  const collection = get(event, 'collection');

  const parsed = aws.S3.parseS3Uri(template);
  aws.S3.get(parsed.Bucket, parsed.Key).then((data) => {
    const message = JSON.parse(data.Body);
    message.provider = provider;
    message.meta = meta;
    message.collection = collection;

    aws.SQS.sendMessage(message.resources.queues.startSF, message)
       .then(r => cb(null, r))
      .catch(e => cb(e));
  }).catch(e => cb(e));
}

function handler(event, context, cb) {
  const queueUrl = get(event, 'queueUrl', null);
  const messageLimit = get(event, 'messageLimit', 1);
  const timeLimit = get(event, 'timeLimit', 90);

  if (queueUrl) {
    const con = new consumer.Consume(queueUrl, messageLimit, timeLimit);
    con.read(dispatch).then(r => cb(null, r)).catch(e => cb(e));
  }
  else {
    cb(new Error('queueUrl is missing'));
  }
}

module.exports.handler = handler;
module.exports.queue = queue;