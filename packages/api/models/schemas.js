'use strict';

// Collection Record Definition
module.exports.collection = {
  title: 'Collection Object',
  description: 'Cumulus-api Collection Table schema',
  type: 'object',
  properties: {
    name: {
      title: 'Name',
      description: 'Collection short_name registered with the CMR',
      type: 'string'
    },
    version: {
      title: 'Version',
      description: 'The version registered with the CMR.',
      type: 'string'
    },
    dataType: {
      title: 'DataType',
      description: 'This is used to identify a granule in a PDR',
      type: 'string'
    },
    process: {
      title: 'Process',
      description: 'Name of the docker process to be used, e.g. modis, aster',
      type: 'string'
    },
    provider_path: {
      title: 'Provider Path',
      description: 'The path to look for the collection Granules or ' +
                   'PDRs. Use regex for recursive search',
      type: 'string',
      default: '/'
    },
    url_path: {
      title: 'Url Path',
      description: 'The folder (url) used to save granules on S3 buckets',
      type: 'string'
    },
    duplicateHandling: {
      title: 'Duplicate Granule Handling',
      description: 'How to handle duplicate granules',
      type: 'string',
      enum: ['skip', 'replace', 'version'],
      default: 'replace'
    },
    granuleId: {
      title: 'GranuleId Validation Regex',
      description: 'The regex used to validate the granule id generated by the system',
      type: 'string'
    },
    granuleIdExtraction: {
      title: 'GranuleId Extraction Regex',
      description: 'The regex used to extract the granule id from granule id filenames',
      type: 'string'
    },
    sampleFileName: {
      title: 'Sample Filename',
      description: 'Is used to validate to test granule id ' +
                   'validation and extraction regexes against',
      type: 'string'
    },
    files: {
      title: 'Files',
      description: 'List of file definitions',
      type: 'array',
      items: {
        type: 'object',
        properties: {
          regex: {
            title: 'Regex',
            description: 'Regex used to identify the file',
            type: 'string'
          },
          sampleFileName: {
            title: 'Sample Filename',
            description: 'Filename used to validate the provided regex',
            type: 'string'
          },
          bucket: {
            title: 'Bucket',
            description: 'Bucket name used to store the file',
            type: 'string'
          },
          url_path: {
            title: 'Url Path',
            description: 'Folder used to save the granule in the bucket. ' +
                         'Defaults to the collection url path',
            type: 'string'
          }
        },
        required: [
          'regex',
          'sampleFileName',
          'bucket'
        ]
      }
    },
    createdAt: {
      type: 'number',
      readonly: true
    },
    updatedAt: {
      type: 'number',
      readonly: true
    }
  },
  required: [
    'name',
    'version',
    'granuleId',
    'granuleIdExtraction',
    'sampleFileName',
    'files',
    'createdAt',
    'updatedAt'
  ]
};

// Granule Record Schema
module.exports.granule = {
  title: 'Granule Object',
  type: 'object',
  properties: {
    granuleId: {
      title: 'Granule ID',
      type: 'string',
      readonly: true
    },
    pdrName: {
      title: 'PDR associated with the granule',
      type: 'string',
      readonly: true
    },
    collection: {
      title: 'Collection associated with the granule',
      type: 'string',
      readonly: true
    },
    status: {
      title: 'Ingest status of the granule',
      enum: ['running', 'completed', 'failed'],
      type: 'string',
      readonly: true
    },
    execution: {
      title: 'Step Function Execution link',
      type: 'string',
      readonly: true
    },
    cmrLink: {
      type: 'string',
      readonly: true
    },
    published: {
      type: 'boolean',
      default: false,
      description: 'shows whether the granule is published to CMR',
      readonly: true
    },
    duration: {
      title: 'Ingest duration',
      type: 'number',
      readonly: true
    },
    files: {
      title: 'Files',
      description: 'List of file definitions',
      type: 'array',
      items: {
        type: 'object'
      }
    },
    error: {
      type: 'string',
      readonly: true
    },
    createdAt: {
      type: 'number',
      readonly: true
    }
  },
  required: [
    'granuleId',
    'collection',
    'status',
    'execution',
    'createdAt'
  ]
};

// Ingest Rule Record Schema
module.exports.rule = {
  title: 'Ingest Rule Record Object',
  type: 'object',
  properties: {
    name: {
      title: 'name',
      type: 'string'
    },
    workflow: {
      title: 'Workflow Name',
      type: 'string'
    },
    provider: {
      title: 'Provider ID',
      type: 'string'
    },
    collection: {
      title: 'Collection Name and Version',
      type: 'object',
      properties: {
        name: {
          title: 'Collection Name',
          type: 'string'
        },
        version: {
          title: 'Collection Version',
          type: 'string'
        }
      },
      required: ['name', 'version']
    },
    meta: {
      title: 'Optional MetaData for the Rule',
      type: 'object'
    },
    rule: {
      title: 'Ingest Rule',
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['onetime', 'scheduled', 'sns', 'kinesis']
        },
        value: {
          type: 'string'
        },
        arn: {
          type: 'string',
          readonly: true
        }
      },
      required: ['type']
    },
    state: {
      title: 'Rule state',
      type: 'string',
      enum: ['ENABLED', 'DISABLED']
    },
    createdAt: {
      type: 'number',
      readonly: true
    },
    updatedAt: {
      type: 'number',
      readonly: true
    }
  },
  require: ['name', 'workflow', 'collection', 'rule', 'state']
};

// PDR Record Schema
module.exports.pdr = {
  title: 'PDR Record Object',
  type: 'object',
  properties: {
    pdrName: {
      title: 'PDR Name',
      type: 'string',
      readonly: true
    },
    collection: {
      title: 'Collection Name',
      type: 'string',
      readonly: true
    },
    provider: {
      title: 'Provider Name',
      type: 'string',
      readonly: true
    },
    status: {
      type: 'string',
      enum: ['running', 'failed', 'completed'],
      readonly: true
    },
    progress: {
      type: 'number',
      readonly: true
    },
    execution: {
      type: 'string',
      readonly: true
    },
    PANsent: {
      type: 'boolean',
      readonly: true
    },
    PANmessage: {
      type: 'string',
      readonly: true
    },
    stats: {
      type: 'object',
      readonly: true,
      properties: {
        total: {
          type: 'number'
        },
        completed: {
          type: 'number'
        },
        failed: {
          type: 'number'
        },
        processing: {
          type: 'number'
        }
      }
    },
    address: {
      type: 'string',
      readonly: true
    },
    originalUrl: {
      type: 'string',
      readonly: true
    },
    createdAt: {
      type: 'number',
      readonly: true
    }
  },
  required: [
    'pdrName',
    'provider',
    'collection',
    'status',
    'createdAt'
  ]
};

// Provider Schema => the model keeps information about each ingest location
module.exports.provider = {
  title: 'Provider Object',
  description: 'Keep the information about each ingest endpoint',
  type: 'object',
  properties: {
    id: {
      title: 'Provider Name',
      type: 'string'
    },
    globalConnectionLimit: {
      title: 'Concurrent Connnection Limit',
      type: 'number',
      default: 10
    },
    protocol: {
      title: 'Protocol',
      type: 'string',
      enum: ['http', 'ftp', 'sftp', 's3'],
      default: 'http'
    },
    host: {
      title: 'Host',
      type: 'string'
    },
    port: {
      title: 'Port',
      type: 'number'
    },
    username: {
      type: 'string'
    },
    password: {
      type: 'string'
    },
    encrypted: {
      type: 'boolean',
      readonly: true
    },
    createdAt: {
      type: 'number',
      readonly: true
    },
    updatedAt: {
      type: 'number',
      readonly: true
    }
  },
  required: [
    'id',
    'globalConnectionLimit',
    'protocol',
    'host',
    'createdAt'
  ]
};

