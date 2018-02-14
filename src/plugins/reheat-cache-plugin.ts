import {
  default as Theia,
  TheiaPlugin,
  TheiaBuildManifestEntry
} from '../theia'
import { SQS } from 'aws-sdk'

class ReheatCachePlugin implements TheiaPlugin {
  sqs: SQS
  queueUrl: string

  constructor (queueUrl: string) {
    this.sqs = new SQS()
    this.queueUrl = queueUrl
  }

  apply (theia: Theia) {
    theia.hooks.componentLibraryUpdate.tap('ReheatCachePlugin', this.onComponentLibraryUpdate.bind(this))
  }

  onComponentLibraryUpdate (theia: Theia, componentLibrary: string, manifestEntry: TheiaBuildManifestEntry) {
    console.log(`reheating cache for ${componentLibrary} ...`)
    const messageAttributes: SQS.Types.MessageBodyAttributeMap = {
      'Type': {
        DataType: 'String',
        StringValue: 'new-build-job'
      },
      'ComponentLibrary': {
        DataType: 'String',
        StringValue: componentLibrary
      }
    }
    const messageBody = {
      'builtAt': manifestEntry.createdAt,
      'commitHash': manifestEntry.commitHash
    }
    const params: SQS.Types.SendMessageRequest = {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify(messageBody),
      QueueUrl: this.queueUrl
    }
    this.sqs.sendMessage(params, (err, data) => {
      if (err) {
        theia.hooks.error.call(theia, err)
      }
    })
  }
}

export default ReheatCachePlugin
