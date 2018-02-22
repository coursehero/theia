// when the build service runs, it updates the build-manifest in storage (S3)
// the other instances of Theia (the ones that actuall render requests) won't get the new manifest b/c of internal caching
// for now, just clear the cache periodically
// a real solution is to have the build service alert the render services when a build has occured

class InvalidateBuildManifestCachePlugin implements Theia.Plugin {
  invalidationInterval: number

  constructor (invalidationInterval: number) {
    this.invalidationInterval = invalidationInterval
  }

  apply (core: Theia.Core) {
    core.hooks.start.tap('BuildPlugin', this.onStart.bind(this))
  }

  onStart (core: Theia.Core) {
    setInterval(() => {
      core.clearCache()
    }, this.invalidationInterval)
  }
}

export default InvalidateBuildManifestCachePlugin
