/* eslint-disable no-param-reassign */
'use strict';

const test = require('ava');
const MockAWS = require('@mapbox/mock-aws-sdk-js');

const { s3, sqs, recursivelyDeleteS3Bucket } = require('@cumulus/common/aws');
const { createQueue, randomString } = require('@cumulus/common/test-utils');

const { handler } = require('../index');
const inputJSON = require('./fixtures/input.json');
const workflowTemplate = require('./fixtures/workflow-template.json');

const aws = require('@cumulus/common/aws');

test.beforeEach(async (t) => {
  t.context.queueUrl = await createQueue();

  t.context.bucket = randomString();
  return s3().createBucket({ Bucket: t.context.bucket }).promise();
});

test.afterEach.always((t) =>
  Promise.all([
    recursivelyDeleteS3Bucket(t.context.bucket),
    sqs().deleteQueue({ QueueUrl: t.context.queueUrl }).promise()
  ]));

test('queue pdrs', async (t) => {
  const Bucket = t.context.bucket;
  const ParsePdrTemplate = `s3://${Bucket}/dev/workflows/ParsePdr.json`;

  await aws.s3().putObject({
    Bucket,
    Key: 'dev/workflows/ParsePdr.json',
    Body: JSON.stringify(workflowTemplate)
  }).promise();

  MockAWS.stub('StepFunctions', 'describeExecution').returns({
    promise: () => Promise.resolve({})
  });

  const input = Object.assign({}, inputJSON);
  input.config.templateUri = ParsePdrTemplate;
  input.config.queueUrl = t.context.queueUrl;

  return handler(input, {}, (e, output) => {
    t.ifError(e);
    t.is(typeof output, 'object');
    t.is(output.pdrs_queued, 2);
    MockAWS.StepFunctions.restore();
  });
});