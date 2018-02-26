class ReheatCachePlugin implements Theia.Plugin {
  apply (core: Theia.Core) {
    core.hooks.componentLibraryUpdate.tap('ReheatCachePlugin', this.onComponentLibraryUpdate.bind(this))
  }

  onComponentLibraryUpdate (core: Theia.Core, componentLibrary: string, manifestEntry: Theia.BuildManifestEntry) {
    console.log(`reheating cache for ${componentLibrary} ...`)
    console.log('TODO: implement')
  }
}

export default ReheatCachePlugin
