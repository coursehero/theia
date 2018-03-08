import { WebClient } from '@slack/client'

interface CtorParams {
  channel: string
  token?: string
}

// goal: https://git.coursehero.com/coursehero/components/study-guides/commit/19a8435a97787d8a1849a63f5dbb739281ce977f
function getCommitUrl (core: Theia.Core, gitSource: string, commitHash: string) {
  const [host, repoPath] = gitSource.replace('git@', '').replace('.git', '').split(':', 2)
  return `${host}/${repoPath}/commit/${commitHash}`
}

class SlackPlugin implements Theia.Plugin {
  client: WebClient
  channel: string

  constructor ({ channel, token }: CtorParams) {
    this.channel = channel
    this.client = new WebClient(token || process.env.SLACK_TOKEN!)
  }

  apply (core: Theia.Core) {
    core.hooks.componentLibraryUpdate.tap('SlackPlugin', this.onComponentLibraryUpdate.bind(this))
  }

  onComponentLibraryUpdate (core: Theia.Core, componentLibrary: string, manifestEntry: Theia.BuildManifestEntry) {
    const gitSource = core.config.libs[componentLibrary].source // ex: git@git.coursehero.com:coursehero/components/study-guides.git
    const commitUrl = getCommitUrl(core, gitSource, manifestEntry.commitHash)

    const message = `\`\`\`
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
      icon_emoji: ':baby:'
    }

    this.client.chat.postMessage(this.channel, message, opts).then((res) => {
      console.log('Message sent: ', res.ts)
    }).catch(err => {
      console.log(err)
      core.hooks.error.call(core, err)
    })
  }
}

export default SlackPlugin
