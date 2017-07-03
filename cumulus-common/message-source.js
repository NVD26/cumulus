'use strict';

const readline = require('readline');
const aws = require('./aws');
const log = require('./log');

/**
 * TODO Add docs
 */
const MessageSource = exports.MessageSource = class {
  constructor(message, context) {
    this.messageData = message;
    this.messages = [];
    this.context = context;
  }

  loadMessageData() {
    return this.messageData;
  }

  loadConfigTemplate() {
    // Default implementation useful for local invocations
    const task = this.messageData.ingest_meta && this.messageData.ingest_meta.task;
    if (task) {
      return this.messageData.workflow_config_template[task];
    }
    throw new Error('No task configuration specified');
  }

  saveState(taskName, data) { // eslint-disable-line no-unused-vars
    log.warn('saveState requested but not implemented');
  }

  loadState(taskName) {  // eslint-disable-line no-unused-vars
    log.warn('loadState requested but not implemented');
  }

  wait() {
    return Promise.all(this.messages);
  }

  complete() {
    return this.wait();
  }

  fail() {
    return this.wait();
  }

  performLambdaCallback(handler, callback, error, data) {
    callback(error, data);
  }

  retry() {
    log.error('Retry requested but not implemented');
    return this.wait();
  }
};

class StateMachineS3MessageSource extends MessageSource {
  constructor(message, context) {
    super(message, context);
    this.originalMessage = message;

    if (message.resources) {
      this.bucket = message.resources.buckets.private;
    }
    if (message.meta) {
      this.key = message.meta.key || message.meta.collection;
    }
  }

  saveState(taskName, data) {
    const params = {
      Bucket: this.bucket,
      Key: [`${taskName}-state`, this.key].join('/'),
      Body: JSON.stringify(data)
    };
    const upload = aws.promiseS3Upload(params);
    this.messages.push(upload);
    return upload;
  }

  async loadConfigTemplate() {
    const workflowConfig = this.messageData.workflow_config_template;
    const meta = this.messageData.ingest_meta;

    const taskName = await aws.getCurrentSfnTask(meta.state_machine, meta.execution_name);
    return workflowConfig[taskName];
  }

  async loadState(taskName) {
    if (!this.key) {
      return null;
    }
    try {
      const s3Config = {
        Bucket: this.bucket,
        Key: [`${taskName}-state`, this.key].join('/')
      };
      const data = await aws.s3().getObject(s3Config).promise();

      return JSON.parse(data.Body.toString());
    }
    catch (e) {
      if (e.code !== 'NoSuchKey') {
        throw e;
      }
    }
    return null;
  }

  async loadMessageData() {
    const message = this.originalMessage;
    if (!message.payload || !message.payload.Bucket || !message.payload.Key) {
      return message;
    }
    const payloadJson = await aws.s3().getObject(message.payload).promise();
    return Object.assign({}, message, { payload: JSON.parse(payloadJson.Body) });
  }

  static isSourceFor(message) {
    return message.ingest_meta.message_source === 'sfn';
  }

  performLambdaCallback(handler, callback, error, data) {
    if (error || (data && data.exception)) {
      callback(error, data);
      return error;
    }

    if (!data) {
      const message = Object.assign({}, this.originalMessage, { payload: data, exception: 'None' });
      callback(null, message);
    }

    const scopedKey = [handler.name, this.key].join('/');
    const params = {
      Bucket: this.bucket,
      Key: scopedKey,
      Body: JSON.stringify(data) || '{}'
    };

    const promise = aws.promiseS3Upload(params).then(() => {
      const payload = { Bucket: params.Bucket, Key: params.Key };
      const messageData = Object.assign({},
                                      this.originalMessage,
                                      { payload: payload, exception: 'None' });
      log.info('Complete. Config uploaded to ', params.Key);
      callback(null, messageData);
    });
    this.messages.push(promise);
    return promise;
  }
}

class InlineMessageSource extends MessageSource {
  static isSourceFor() {
    return true;
  }

  performLambdaCallback(handler, callback, error, data) {
    const outputData = Object.assign({}, this.messageData, { payload: data, exception: 'None' });
    if (!error) {
      log.warn('inline-result: ', JSON.stringify(outputData));
    }
    super.performLambdaCallback(handler, callback, error, outputData);
  }
}


class StdinMessageSource extends InlineMessageSource {
  constructor(message) {
    super(message);
    const messages = [];
    this.callbacks = [];

    const rl = readline.createInterface({
      input: process.stdin
    });

    rl.on('line', (line) => {
      if (line.startsWith('[WARN] inline-result: ')) {
        const body = line.replace('[WARN] inline-result: ', '');
        messages.push(JSON.parse(body));
      }
    });
    rl.on('close', () => {
      this.stdinMessages = messages;
      for (const callback of this.callbacks) {
        callback();
      }
    });
  }

  async loadMessageData() {
    const result = await this.getMessageScopedJson();
    Object.assign(this.messageData, result);
    return this.messageData;
  }

  getMessageScopedJsonImmediate() {
    for (const value of this.stdinMessages) {
      if (this.messageData.ingest_meta && this.messageData.ingest_meta.task) {
        value.ingest_meta = value.ingest_meta || {};
        value.ingest_meta.task = this.messageData.ingest_meta.task;
      }
      return value;
    }
    return null;
  }

  getMessageScopedJson() {
    return new Promise((success) => {
      if (this.stdinMessages) {
        success(this.getMessageScopedJsonImmediate());
      }
      else {
        this.callbacks.push(() => {
          success(this.getMessageScopedJsonImmediate());
        });
      }
    });
  }

  loadState() {
    return this.messageData && this.messageData.state;
  }

  static isSourceFor(message) {
    return message.ingest_meta.message_source === 'stdin';
  }
}


exports.messageSources = [
  StateMachineS3MessageSource,
  StdinMessageSource,
  InlineMessageSource
];


/**
 * Returns an appropriate message source for the given message
 * @param {object} message - The incoming AWS Lambda message
 * @param {object} context - The incoming AWS Lambda context
 * @param {array} maybeSources - Message sources to use for lookup. If null,
 *                               use exports.messageSources)
 * @return A constructed MessageSource instance for the given message
 */
exports.forEvent = (message, context, maybeSources) => {
  const sources = maybeSources || exports.messageSources;
  let Source;
  for (Source of sources) {
    if (Source.isSourceFor(message)) {
      break;
    }
  }
  return new Source(message, context);
};