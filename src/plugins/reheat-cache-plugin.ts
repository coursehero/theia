import * as AWS from 'aws-sdk'
import { promisify } from 'util'

class ReheatCachePlugin implements Theia.Plugin {
  sqs = new AWS.SQS()

  constructor (public queueUrl: string) {}

  apply (core: Theia.Core) {
    core.hooks.componentLibraryUpdate.tapPromise('ReheatCachePlugin', this.onComponentLibraryUpdate)
  }

  onComponentLibraryUpdate = (core: Theia.Core, componentLibrary: string, manifestEntry: Theia.BuildManifestEntry) => {
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

    // TS was choosing the wrong method overload. help it out a bit
    type X = (params: AWS.SQS.Types.SendMessageRequest, callback?: (err: AWS.AWSError, data: AWS.SQS.Types.SendMessageResult) => void) => AWS.Request<AWS.SQS.Types.SendMessageResult, AWS.AWSError>
    const sendMessagePromise = promisify(this.sqs.sendMessage.bind(this.sqs) as X)
    return sendMessagePromise(params).then(() => Promise.resolve()) // discard return value
  }
}

export default ReheatCachePlugin
