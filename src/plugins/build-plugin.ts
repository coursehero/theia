import { Core, Plugin } from '../theia'

type OnStartArgs = {
  core: Core
}

class BuildPlugin implements Plugin {
  constructor (public buildInterval: number) {}

  apply (core: Core) {
    core.hooks.start.tapPromise('BuildPlugin', this.onStart)
  }

  onStart = ({ core }: OnStartArgs) => {
    void core.buildAll() // do it once, supress lint error
    setInterval(core.buildAll.bind(core), this.buildInterval) // do it in interval
    return Promise.resolve()
  }
}

export default BuildPlugin
