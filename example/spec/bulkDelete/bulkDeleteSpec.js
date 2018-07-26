'use strict';

const sleep = require('sleep-promise');
const { ecs } = require('@cumulus/common/aws');
const { api: apiTestUtils } = require('@cumulus/integration-tests');
const { loadConfig } = require('../helpers/testUtils');

// Find the ECS Cluster ARN for the given Cumulus stack
async function getClusterArn(stackName) {
  const clusterPrefix = `${stackName}-CumulusECSCluster-`;
  const listClustersResponse = await ecs().listClusters().promise();
  return listClustersResponse.clusterArns.find((arn) => arn.includes(clusterPrefix));
}

/**
 * Wait for an AsyncOperation to reach an expected state, then return the
 *   AsyncOperation.
 *
 * @param {Object} params - params
 * @param {string} params.stackName - the Cumulus stack name
 * @param {Array<string>} params.expectedStates - the states that we are waiting
 *   for the AsyncOperation to reach.  Defaults to ['SUCCEEDED', 'FAILED']
 * @param {string} params.asyncOperationId - the id of the AsyncOperation
 * @param {integer} params.waitSeconds - the number of seconds to wait for the
 *   AsyncOperation to reach an expected state.  Defaults to 300.
 * @returns {Promise<Object>} a GET /asyncOperation/{id} response
 */
async function waitForAsyncOperation({
  stackName,
  expectedStates = ['SUCCEEDED', 'FAILED'],
  asyncOperationId,
  waitSeconds = 300
}) {
  let getAsyncOperationResponse;
  let getAsyncOperationBody;
  let checksRemaining = Math.floor(waitSeconds / 2);

  do {
    // Call GET /asyncOperation/{asyncOperationId} to get the status
    getAsyncOperationResponse = await apiTestUtils.getAsyncOperation({ // eslint-disable-line no-await-in-loop
      prefix: stackName,
      id: asyncOperationId
    });
    getAsyncOperationBody = JSON.parse(getAsyncOperationResponse.body);

    // If we've reached an expected state then exit the loop
    if (expectedStates.includes(getAsyncOperationBody.status)) break;

    checksRemaining -= 1;
    if (checksRemaining > 0) await sleep(2000); // eslint-disable-line no-await-in-loop
  } while (checksRemaining > 0);

  // If the AsyncOperation never reached an expected state, throw an exception
  if (checksRemaining <= 0) throw new Error('Timed out');

  return getAsyncOperationResponse;
}

describe('POST /bulkDelete with a successful bulk delete operation', () => {
  let postBulkDeleteResponse;
  let postBulkDeleteBody;
  let config;

  let beforeAllSucceeded = false;
  beforeAll(async () => {
    config = loadConfig();

    postBulkDeleteResponse = await apiTestUtils.postBulkDelete({
      prefix: config.stackName,
      granuleIds: ['g-123']
    });
    postBulkDeleteBody = JSON.parse(postBulkDeleteResponse.body);

    beforeAllSucceeded = true;
  });

  it('returns a status code of 202', () => {
    expect(beforeAllSucceeded).toBe(true);
    expect(postBulkDeleteResponse.statusCode).toEqual(202);
  });

  it('returns an Async Operation Id', () => {
    expect(beforeAllSucceeded).toBe(true);
    expect(postBulkDeleteBody.asyncOperationId).toMatch(/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/);
  });

  it('creates an AsyncOperation', async () => {
    expect(beforeAllSucceeded).toBe(true);

    const getAsyncOperationResponse = await apiTestUtils.getAsyncOperation({
      prefix: config.stackName,
      id: postBulkDeleteBody.asyncOperationId
    });

    expect(getAsyncOperationResponse.statusCode).toEqual(200);

    const getAsyncOperationBody = JSON.parse(getAsyncOperationResponse.body);

    expect(getAsyncOperationBody.id).toEqual(postBulkDeleteBody.asyncOperationId);
  });

  it('runs an ECS task', async () => {
    expect(beforeAllSucceeded).toBe(true);

    // Query the AsyncOperation API to get the task ARN
    const getAsyncOperationResponse = await apiTestUtils.getAsyncOperation({
      prefix: config.stackName,
      id: postBulkDeleteBody.asyncOperationId
    });
    const { taskArn } = JSON.parse(getAsyncOperationResponse.body);

    // Figure out what cluster we're using
    const clusterArn = await getClusterArn(config.stackName);
    if (!clusterArn) throw new Error('Unable to find ECS cluster');

    // Verify that the task ARN exists in that cluster
    const describeTasksResponse = await ecs().describeTasks({
      cluster: clusterArn,
      tasks: [taskArn]
    }).promise();

    expect(describeTasksResponse.tasks.length).toEqual(1);
  });

  it('eventually generates the correct result', async () => {
    expect(beforeAllSucceeded).toBe(true);

    const getAsyncOperationResponse = await waitForAsyncOperation({
      stackName: config.stackName,
      asyncOperationId: postBulkDeleteBody.asyncOperationId
    });

    const getAsyncOperationBody = JSON.parse(getAsyncOperationResponse.body);

    expect(getAsyncOperationResponse.statusCode).toEqual(200);
    expect(getAsyncOperationBody.status).toEqual('SUCCEEDED');
    expect(getAsyncOperationBody.error).toBeUndefined();

    let result;
    try {
      result = JSON.parse(getAsyncOperationBody.result);
    }
    catch (err) {
      throw new SyntaxError(`getAsyncOperationBody.result is not valid JSON: ${getAsyncOperationBody.result}`);
    }

    expect(result).toEqual({ deletedGranules: ['g-123'] });
  });
});

describe('POST /bulkDelete with a failed bulk delete operation', () => {
  let postBulkDeleteResponse;
  let postBulkDeleteBody;
  let config;

  let beforeAllSucceeded = false;
  beforeAll(async () => {
    config = loadConfig();

    postBulkDeleteResponse = await apiTestUtils.postBulkDelete({
      prefix: config.stackName,
      granuleIds: ['trigger-failure']
    });
    postBulkDeleteBody = JSON.parse(postBulkDeleteResponse.body);

    beforeAllSucceeded = true;
  });

  it('returns a status code of 202', () => {
    expect(beforeAllSucceeded).toBe(true);
    expect(postBulkDeleteResponse.statusCode).toEqual(202);
  });

  it('returns an Async Operation Id', () => {
    expect(beforeAllSucceeded).toBe(true);
    expect(postBulkDeleteBody.asyncOperationId).toMatch(/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/);
  });

  it('creates an AsyncOperation', async () => {
    expect(beforeAllSucceeded).toBe(true);

    const getAsyncOperationResponse = await apiTestUtils.getAsyncOperation({
      prefix: config.stackName,
      id: postBulkDeleteBody.asyncOperationId
    });

    expect(getAsyncOperationResponse.statusCode).toEqual(200);

    const getAsyncOperationBody = JSON.parse(getAsyncOperationResponse.body);

    expect(getAsyncOperationBody.id).toEqual(postBulkDeleteBody.asyncOperationId);
  });

  it('runs an ECS task', async () => {
    expect(beforeAllSucceeded).toBe(true);

    // Query the AsyncOperation API to get the task ARN
    const getAsyncOperationResponse = await apiTestUtils.getAsyncOperation({
      prefix: config.stackName,
      id: postBulkDeleteBody.asyncOperationId
    });
    const { taskArn } = JSON.parse(getAsyncOperationResponse.body);

    // Figure out what cluster we're using
    const clusterArn = await getClusterArn(config.stackName);
    if (!clusterArn) throw new Error('Unable to find ECS cluster');

    // Verify that the task ARN exists in that cluster
    const describeTasksResponse = await ecs().describeTasks({
      cluster: clusterArn,
      tasks: [taskArn]
    }).promise();

    expect(describeTasksResponse.tasks.length).toEqual(1);
  });

  it('eventually generates the correct result', async () => {
    expect(beforeAllSucceeded).toBe(true);

    const getAsyncOperationResponse = await waitForAsyncOperation({
      stackName: config.stackName,
      asyncOperationId: postBulkDeleteBody.asyncOperationId
    });
    const getAsyncOperationBody = JSON.parse(getAsyncOperationResponse.body);

    expect(getAsyncOperationResponse.statusCode).toEqual(200);
    expect(getAsyncOperationBody.status).toEqual('FAILED');
    expect(getAsyncOperationBody.error).toEqual('triggered failure');
    expect(getAsyncOperationBody.result).toBeUndefined();
  });
});
