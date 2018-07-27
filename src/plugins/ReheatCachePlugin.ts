import * as AWS from 'aws-sdk'
import { BuildManifestEntry, Core, CoreHooks, Plugin } from '../theia'

class ReheatCachePlugin implements Plugin {
  sqs = new AWS.SQS()

  constructor (public queues: {[componentLibrary: string]: string}) {}

  apply (core: Core) {
    core.hooks.express.tapPromise('ReheatCachePlugin', this.onExpress)
    core.hooks.componentLibraryUpdate.tapPromise('ReheatCachePlugin', this.onComponentLibraryUpdate)
  }

  onExpress = ({ core, app }: CoreHooks.OnExpressArgs) => {
    app.get('/queues', (req, res) => {
      res.send(this.queues)
    })

    return Promise.resolve()
  }

  onComponentLibraryUpdate = async ({ core, componentLibrary, manifestEntry }: CoreHooks.OnComponentLibraryUpdateArgs) => {
    core.log(`theia:reheat ${componentLibrary}`, 'reheating cache')

    core.log(`theia:reheat ${componentLibrary}`, 'purging queue')
    await this.purge(componentLibrary)

    core.log(`theia:reheat ${componentLibrary}`, 'sending new-build-job')
    await this.send(componentLibrary, manifestEntry)
  }

  purge = (componentLibrary: string) => {
    const params: AWS.SQS.Types.PurgeQueueRequest = {
      QueueUrl: this.queues[componentLibrary]
    }
    return new Promise((resolve, reject) => {
      this.sqs.purgeQueue(params, (err) => {
        if (err) reject(err)
        resolve()
      })
    })
  }

  send = (componentLibrary: string, manifestEntry: BuildManifestEntry) => {
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
      QueueUrl: this.queues[componentLibrary],
      DelaySeconds: 10
    }

    return new Promise((resolve, reject) => {
      this.sqs.sendMessage(params, (err) => {
        if (err) reject(err)
        resolve()
      })
    })
  }
}

export default ReheatCachePlugin
