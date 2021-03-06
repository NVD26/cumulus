'use strict';

const fs = require('fs-extra');
const { get } = require('lodash');
const { models: { Granule } } = require('@cumulus/api');
const { aws: { s3 } } = require('@cumulus/common');
const { buildAndExecuteWorkflow } = require('@cumulus/integration-tests');
const { api: apiTestUtils } = require('@cumulus/integration-tests');

const { loadConfig } = require('../helpers/testUtils');
const { setupTestGranuleForIngest } = require('../helpers/granuleUtils');
const config = loadConfig();
const workflowName = 'IngestGranule';

const granuleRegex = '^MOD09GQ\\.A[\\d]{7}\\.[\\w]{6}\\.006\\.[\\d]{13}$';
const testDataGranuleId = 'MOD09GQ.A2016358.h13v04.006.2016360104606';

describe('The Ingest Granule failure workflow', () => {
  const inputPayloadFilename = './spec/ingestGranule/IngestGranule.input.payload.json';
  const collection = { name: 'MOD09GQ', version: '006' };
  const provider = { id: 's3_provider' };
  let workflowExecution = null;
  let inputPayload;

  process.env.GranulesTable = `${config.stackName}-GranulesTable`;
  const granuleModel = new Granule();

  beforeAll(async () => {
    const inputPayloadJson = fs.readFileSync(inputPayloadFilename, 'utf8');
    inputPayload = await setupTestGranuleForIngest(config.bucket, inputPayloadJson, testDataGranuleId, granuleRegex);

    // add a non-existent file to input payload to cause lambda error
    const nonexistentFile = { path: 'non-existent-path', name: 'non-existent-file' };
    inputPayload.granules[0].files.push(nonexistentFile);

    // delete the granule record from DynamoDB if exists
    await granuleModel.delete({ granuleId: inputPayload.granules[0].granuleId });

    workflowExecution = await buildAndExecuteWorkflow(
      config.stackName, config.bucket, workflowName, collection, provider, inputPayload
    );
  });

  afterAll(async () => {
    // Remove the granule files added for the test
    await Promise.all(
      inputPayload.granules[0].files.map((file) =>
        s3().deleteObject({
          Bucket: config.bucket, Key: `${file.path}/${file.name}`
        }).promise())
    );
  });

  it('completes execution with failure status', () => {
    expect(workflowExecution.status).toEqual('FAILED');
  });

  describe('When a workflow task is configured to catch a specific error and branch and the error is thrown by a Cumulus task', () => {
    let execution;
    let executionStatus;
    let syncGranFailedDetail;
    let syncGranStepOutput;

    beforeAll(async () => {
      const executionArn = workflowExecution.executionArn;
      execution = await apiTestUtils.getExecution({
        prefix: config.stackName,
        arn: executionArn
      });
      executionStatus = await apiTestUtils.getExecutionStatus({
        prefix: config.stackName,
        arn: executionArn
      });
    });

    it('branches appropriately according to the CMA output', async () => {
      expect(executionStatus.executionHistory).toBeTruthy();
      const events = executionStatus.executionHistory.events;

      const syncGranuleNoVpcTaskName = 'SyncGranuleNoVpc';
      const stopStatusTaskName = 'StopStatus';

      let choiceVerified = false;
      for (let i = 0; i < events.length; i += 1) {
        const currentEvent = events[i];

        if (currentEvent.type === 'TaskStateExited' &&
        get(currentEvent, 'name') === syncGranuleNoVpcTaskName) {
          syncGranStepOutput = get(currentEvent, 'output');
          expect(syncGranStepOutput.exception).toBeTruthy();

          // the previous step has the original error thrown from lambda
          const previousEvent = events[i - 1];
          expect(previousEvent.type).toBe('LambdaFunctionFailed');
          syncGranFailedDetail = previousEvent;

          // get the next task executed
          let nextTask;
          while (!nextTask && i < events.length - 1) {
            i += 1;
            const nextEvent = events[i];
            if (nextEvent.type === 'TaskStateEntered' &&
              get(nextEvent, 'name')) {
              nextTask = get(nextEvent, 'name');
            }
          }

          expect(nextTask).toEqual(stopStatusTaskName);
          choiceVerified = true;
          break;
        }
      }

      expect(choiceVerified).toBe(true);
    });

    it('propagates the error message to CMA output for next step', async () => {
      const syncGranExceptionCause = JSON.parse(syncGranStepOutput.exception.Cause);
      const syncGranFailedCause = JSON.parse(syncGranFailedDetail.cause);
      expect(syncGranStepOutput.exception.Error).toBe(syncGranFailedDetail.error);
      expect(syncGranExceptionCause).toEqual(syncGranFailedCause);
    });

    it('logs the execution with the error message', async () => {
      expect(execution.error.Error).toBe(syncGranFailedDetail.error);
      expect(JSON.parse(execution.error.Cause)).toEqual(JSON.parse(syncGranFailedDetail.cause));
    });

    it('fails the granule with the error message', async () => {
      const granule = await apiTestUtils.getGranule({
        prefix: config.stackName,
        granuleId: inputPayload.granules[0].granuleId
      });

      expect(granule.status).toBe('failed');
      expect(granule.error.Error).toBe(syncGranFailedDetail.error);
      expect(JSON.parse(granule.error.Cause)).toEqual(JSON.parse(syncGranFailedDetail.cause));
    });
  });
});
