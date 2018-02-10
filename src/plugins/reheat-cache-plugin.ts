import Theia from '../theia'

class ReheatCachePlugin implements Theia.Plugin {
  apply (theia: Theia) {
    theia.hooks.componentLibraryUpdate.tap('ReheatCachePlugin', this.onComponentLibraryUpdate.bind(this))
  }

  onComponentLibraryUpdate (theia: Theia, componentLibrary: string, manifestEntry: Theia.BuildManifestEntry) {
    console.log(`reheating cache for ${componentLibrary} ...`)
    console.log('TODO: implement')
  }
}

export default ReheatCachePlugin
