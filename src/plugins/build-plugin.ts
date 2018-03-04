class BuildPlugin implements Theia.Plugin {
  buildInterval: number

  constructor (buildInterval: number) {
    this.buildInterval = buildInterval
  }

  apply (core: Theia.Core) {
    core.hooks.start.tap('BuildPlugin', this.onStart.bind(this))
  }

  onStart (core: Theia.Core) {
    const action = () => {
      core.buildAll().then(() => {
        console.log('finished building component libraries')
      }).catch(() => {
        console.error('error while building component libraries')
      })
    }

    action()
    setInterval(action, this.buildInterval)
  }
}

export default BuildPlugin
