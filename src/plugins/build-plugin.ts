import { Core, CoreHooks, Plugin } from '../theia'

class BuildPlugin implements Plugin {
  constructor (public buildInterval: number) {}

  apply (core: Core) {
    core.hooks.start.tapPromise('BuildPlugin', this.onStart)
  }

  onStart = ({ core }: CoreHooks.OnStartArgs) => {
    void core.buildAll() // do it once, supress lint error
    setInterval(core.buildAll.bind(core), this.buildInterval) // do it in interval
    return Promise.resolve()
  }
}

export default BuildPlugin
