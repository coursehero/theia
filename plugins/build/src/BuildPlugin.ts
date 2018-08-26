import { Core, CoreHooks, Plugin } from '@coursehero/theia'

class BuildPlugin implements Plugin {
  constructor (public buildInterval: number) {}

  apply (core: Core) {
    core.hooks.start.tapPromise('BuildPlugin', this.onStart)
  }

  onStart = ({ core }: CoreHooks.OnStartArgs) => {
    void this.build(core) // do it in interval
    return Promise.resolve()
  }

  build (core: Core): Promise<void> {
    return Promise.resolve()
      .then(async () => {
        await core.buildAll()
      })
      .then(() => new Promise((resolve) => {
        setTimeout(resolve, this.buildInterval)
      }))
      .then(() => this.build(core))
  }
}

export default BuildPlugin
