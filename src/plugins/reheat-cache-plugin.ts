import * as AWS from 'aws-sdk'
import { Core, Plugin, BuildManifestEntry } from '../theia'

type OnComponentLibraryUpdateArgs = {
  core: Core
  componentLibrary: string
  manifestEntry: BuildManifestEntry
}

class ReheatCachePlugin implements Plugin {
  sqs = new AWS.SQS()

  constructor (public queueUrl: string) {}

  apply (core: Core) {
    core.hooks.componentLibraryUpdate.tapPromise('ReheatCachePlugin', this.onComponentLibraryUpdate)
  }

  onComponentLibraryUpdate = ({ core, componentLibrary, manifestEntry }: OnComponentLibraryUpdateArgs) => {
    console.log(`reheating cache for ${componentLibrary} ...`)
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
      QueueUrl: this.queueUrl,
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
