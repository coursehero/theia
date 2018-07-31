import * as AWS from 'aws-sdk'
import { BuildManifestEntry, Core, CoreHooks, Plugin } from '../theia'

interface CacheConfig {
  [componentLibrary: string]: CacheConfigValue
}

interface CacheConfigValue {
  queue?: string
  table?: string
  strategy: 'new-build-job' | 'clear'
}

/*
new-build-job: on a build, create a new-build-job, which the reheating job system should consume and reheat all the pages necessary
clear:         on a build, just clear the table. Pages will get added back to the cache as traffic comes in.

'clear' does not work yet - clearing a DynamoDB table can't be done quickly or easily. Could possibly drop it and make a new table,
but there are some issues re: the rendering client (users of the php-sdk). Dropping a table isn't instant, and you must wait for it to be cleared
before making a new table w/ the same name. Would completely remove caching in the interim. Another option is to make a new table w/ a new name, and
have the client make calls to Theia to get the name of the table, but there are issues with that too.
*/

class CachePlugin implements Plugin {
  sqs = new AWS.SQS()

  constructor (public config: CacheConfig) {
    for (const [componentLibrary, value] of Object.entries(config)) {
      if (value.strategy === 'new-build-job' && !value.queue) {
        throw new Error(`error for ${componentLibrary}: 'new-build-job' cache strategy requires queue`)
      }

      if (value.strategy === 'clear' && !value.table) {
        throw new Error(`error for ${componentLibrary}: 'clear' cache strategy requires table`)
      }
    }
  }

  apply (core: Core) {
    core.hooks.express.tapPromise('CachePlugin', this.onExpress)
    core.hooks.componentLibraryUpdate.tapPromise('CachePlugin', this.onComponentLibraryUpdate)
  }

  onExpress = ({ core, app }: CoreHooks.OnExpressArgs) => {
    app.get('/cache-config', (req, res) => {
      res.send(this.config)
    })

    return Promise.resolve()
  }

  onComponentLibraryUpdate = async ({ core, componentLibrary, manifestEntry }: CoreHooks.OnComponentLibraryUpdateArgs) => {
    if (!this.config[componentLibrary]) {
      core.log(`theia:reheat ${componentLibrary}`, 'no cache strategy')
      return
    }

    core.log(`theia:reheat ${componentLibrary}`, 'reheating cache')

    const strategy = this.config[componentLibrary].strategy
    if (strategy === 'new-build-job') {
      core.log(`theia:reheat ${componentLibrary}`, 'purging queue')
      await this.purge(componentLibrary)

      core.log(`theia:reheat ${componentLibrary}`, 'sending new-build-job')
      await this.send(componentLibrary, manifestEntry)
    } else if (strategy === 'clear') {
      // core.log(`theia:reheat ${componentLibrary}`, 'clearing table')
      // await this.clear(componentLibrary, manifestEntry)
    }
  }

  getQueueUrl = (componentLibrary: string): Promise<string> => {
    const params = {
      QueueName: this.config[componentLibrary].queue!
    }
    return new Promise((resolve, reject) => {
      this.sqs.getQueueUrl(params, (err, data) => {
        if (err) reject(err)
        else resolve(data.QueueUrl!)
      })
    })
  }

  purge = async (componentLibrary: string) => {
    const queueUrl = await this.getQueueUrl(componentLibrary)
    const params: AWS.SQS.Types.PurgeQueueRequest = {
      QueueUrl: queueUrl
    }
    return new Promise((resolve, reject) => {
      this.sqs.purgeQueue(params, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  send = async (componentLibrary: string, manifestEntry: BuildManifestEntry) => {
    const queueUrl = await this.getQueueUrl(componentLibrary)
    const messageAttributes: AWS.SQS.Types.MessageBodyAttributeMap = {
      Type: {
        DataType: 'String',
        StringValue: 'new-build-job'
      },
      ComponentLibrary: {
        DataType: 'String',
        StringValue: componentLibrary
      }
    }
    const messageBody = {
      builtAt: manifestEntry.createdAt,
      commitHash: manifestEntry.commitHash
    }
    const params: AWS.SQS.Types.SendMessageRequest = {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify(messageBody),
      QueueUrl: queueUrl,
      DelaySeconds: 10
    }

    return new Promise((resolve, reject) => {
      this.sqs.sendMessage(params, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

export default CachePlugin
