class BuildPlugin implements Theia.Plugin {

  constructor (public buildInterval: number) {}

  apply (core: Theia.Core) {
    core.hooks.start.tapPromise('BuildPlugin', this.onStart)
  }

  onStart = (core: Theia.Core) => {
    const action = () => {
      core.buildAll().then(() => {
        console.log('finished building component libraries')
      }).catch(() => {
        console.error('error while building component libraries')
      })
    }

    action()
    setInterval(action, this.buildInterval)

    return Promise.resolve()
  }
}

export default BuildPlugin
