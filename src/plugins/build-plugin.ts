class BuildPlugin implements Theia.Plugin {

  constructor (public buildInterval: number) {}

  apply (core: Theia.Core) {
    core.hooks.start.tapPromise('BuildPlugin', this.onStart)
  }

  onStart = (core: Theia.Core) => {
    void core.buildAll() // do it once, supress lint error
    setInterval(core.buildAll.bind(core), this.buildInterval) // do it in interval
    return Promise.resolve()
  }
}

export default BuildPlugin
