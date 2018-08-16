import { WebClient } from '@slack/client'
import { Core, CoreHooks, Plugin } from '../theia'

export interface CtorParams {
  channel: string
  token?: string
}

// goal: https://git.coursehero.com/coursehero/components/study-guides/commit/19a8435a97787d8a1849a63f5dbb739281ce977f
function getCommitUrl (core: Core, gitSource: string, commitHash: string) {
  const [host, repoPath] = gitSource.replace('git@', '').replace('https://', '').replace('.git', '').split(':', 2)
  return `${host}/${repoPath}/commit/${commitHash}`
}

class SlackPlugin implements Plugin {
  client: WebClient
  channel: string

  constructor ({ channel, token }: CtorParams) {
    this.channel = channel
    this.client = new WebClient(token || process.env.SLACK_TOKEN!)
  }

  apply (core: Core) {
    core.hooks.componentLibraryUpdate.tapPromise('SlackPlugin', this.onComponentLibraryUpdate)
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
      console.log('Message sent: ', res.ok)
    })
  }
}

export default SlackPlugin
