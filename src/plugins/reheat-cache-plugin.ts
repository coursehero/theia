import { SQS } from 'aws-sdk'

class ReheatCachePlugin implements Theia.Plugin {
  sqs: SQS
  queueUrl: string

  constructor (queueUrl: string) {
    this.sqs = new SQS()
    this.queueUrl = queueUrl
  }

  apply (core: Theia.Core) {
    core.hooks.componentLibraryUpdate.tap('ReheatCachePlugin', this.onComponentLibraryUpdate.bind(this))
  }

  onComponentLibraryUpdate (core: Theia.Core, componentLibrary: string, manifestEntry: Theia.BuildManifestEntry) {
    console.log(`reheating cache for ${componentLibrary} ...`)
    const messageAttributes: SQS.Types.MessageBodyAttributeMap = {
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
    const params: SQS.Types.SendMessageRequest = {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify(messageBody),
      QueueUrl: this.queueUrl,
      DelaySeconds: 10
    }
    this.sqs.sendMessage(params, (err, data) => {
      if (err) {
        core.hooks.error.call(core, err)
      }
    })
  }
}

export default ReheatCachePlugin
