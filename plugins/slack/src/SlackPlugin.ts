import { Core, CoreHooks, Plugin } from '@coursehero/theia'
import { WebClient } from '@slack/client'

export interface CtorParams {
  channel: string
  token?: string
}

// goal: https://git.coursehero.com/coursehero/components/study-guides/commit/19a8435a97787d8a1849a63f5dbb739281ce977f
function getCommitUrl (core: Core, gitSource: string, commitHash: string) {
  const [host, repoPath] = gitSource.replace('git@', '').replace('https://', '').replace('.git', '').split(':', 2)
  return `${host}/${repoPath}/commit/${commitHash}`
}

function parseMillisecondsIntoReadableTime (ms: number) {
  // Get hours from ms
  const hours = ms / (1000 * 60 * 60)
  const absoluteHours = Math.floor(hours)
  const h = absoluteHours > 9 ? absoluteHours : '0' + absoluteHours

  // Get remainder from hours and convert to minutes
  const minutes = (hours - absoluteHours) * 60
  const absoluteMinutes = Math.floor(minutes)
  const m = absoluteMinutes > 9 ? absoluteMinutes : '0' + absoluteMinutes

  // Get remainder from minutes and convert to seconds
  const seconds = (minutes - absoluteMinutes) * 60
  const absoluteSeconds = Math.floor(seconds)
  const s = absoluteSeconds > 9 ? absoluteSeconds : '0' + absoluteSeconds

  return h + ':' + m + ':' + s
}

class SlackPlugin implements Plugin {
  client: WebClient
  channel: string
  currentBuildTickMessageId: string
  currentBuildTickChannelId: string
  lastMessageSent: string

  constructor ({ channel, token }: CtorParams) {
    this.channel = channel
    this.client = new WebClient(token || process.env.SLACK_TOKEN!)
    this.currentBuildTickMessageId = ''
    this.currentBuildTickChannelId = ''
    this.lastMessageSent = ''
  }

  apply (core: Core) {
    core.hooks.buildTick.tapPromise('SlackPlugin', this.onBuildTick)
    core.hooks.componentLibraryUpdate.tapPromise('SlackPlugin', this.onComponentLibraryUpdate)
  }

  onBuildTick = ({ core, componentLibrary, buildLog }: CoreHooks.OnBuildTickArgs) => {
    if (buildLog.length === 0) {
      this.currentBuildTickMessageId = ''
      this.currentBuildTickChannelId = ''
      this.lastMessageSent = ''
      return Promise.resolve()
    }

    const stagesFormatted = buildLog.map(stage => {
      if (stage.ended) {
        return `${stage.name} - ${parseMillisecondsIntoReadableTime(+stage.ended - +stage.started)}`
      } else {
        return `${stage.name} (Current) - ${parseMillisecondsIntoReadableTime(+new Date() - +stage.started)}`
      }
    })
    const isDone = buildLog[buildLog.length - 1].ended !== null
    const text = `\`\`\`
${isDone ? 'Built' : 'Building'} ${componentLibrary}
${stagesFormatted.join('\n')}
\`\`\``

    if (this.lastMessageSent === text) {
      return Promise.resolve()
    }

    let promise
    if (!this.currentBuildTickMessageId) {
      const opts = {
        username: 'EILEITHYIA',
        icon_emoji: ':baby:',
        channel: this.channel,
        text
      }

      promise = this.client.chat.postMessage(opts).then(res => {
        this.currentBuildTickMessageId = (res).ts
        this.currentBuildTickChannelId = (res).channel
        return res
      })
    } else {
      const opts = {
        channel: this.currentBuildTickChannelId,
        ts: this.currentBuildTickMessageId,
        text
      }

      promise = this.client.chat.update(opts)
    }

    return promise.then((res) => {
      this.lastMessageSent = text
    })
  }

  onComponentLibraryUpdate = ({ core, componentLibrary, manifestEntry }: CoreHooks.OnComponentLibraryUpdateArgs) => {
    const gitSource = core.libs[componentLibrary].source // ex: git@git.coursehero.com:coursehero/components/study-guides.git
    const commitUrl = getCommitUrl(core, gitSource, manifestEntry.commitHash)

    const text = `\`\`\`
New component library build
${commitUrl}
Commit hash: ${manifestEntry.commitHash}
Built at: ${manifestEntry.createdAt}
Author: ${manifestEntry.author.name} <${manifestEntry.author.email}>
${manifestEntry.commitMessage}
\`\`\`
`
    const opts = {
      username: 'EILEITHYIA',
      icon_emoji: ':baby:',
      channel: this.channel,
      text
    }

    return this.client.chat.postMessage(opts).then(res => {
      core.log(`theia:SlackPlugin ${componentLibrary}`, `Message sent: ${res.ok}`)
    })
  }
}

export default SlackPlugin
