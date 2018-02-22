class BuildPlugin implements Theia.Plugin {
  buildInterval: number

  constructor (buildInterval: number) {
    this.buildInterval = buildInterval
  }

  apply (core: Theia.Core) {
    core.hooks.start.tap('BuildPlugin', this.onStart.bind(this))
  }

  onStart (core: Theia.Core) {
    core.builder.buildAll(core)
    setInterval(() => core.builder.buildAll(core), this.buildInterval)
  }
}

export default BuildPlugin
