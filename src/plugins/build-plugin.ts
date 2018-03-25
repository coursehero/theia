class BuildPlugin implements Theia.Plugin {

  constructor (public buildInterval: number) {}

  apply (core: Theia.Core) {
    core.hooks.start.tapPromise('BuildPlugin', this.onStart)
  }

  onStart = (core: Theia.Core) => {
    const action = () => {
      core.buildAll()
    }

    action()
    setInterval(action, this.buildInterval)

    return Promise.resolve()
  }
}

export default BuildPlugin
