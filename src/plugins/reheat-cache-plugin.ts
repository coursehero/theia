import {
  default as Theia,
  TheiaPlugin,
  TheiaBuildManifestLibVersion
} from '../theia'

class ReheatCachePlugin implements TheiaPlugin {
  apply (theia: Theia) {
    theia.hooks.componentLibraryUpdate.tap('ReheatCachePlugin', this.onComponentLibraryUpdate.bind(this))
  }

  onComponentLibraryUpdate (theia: Theia, componentLibrary: string, libVersion: TheiaBuildManifestLibVersion) {
    console.log(`reheating cache for ${componentLibrary} ...`)
    console.log('TODO: implement')
  }
}

export default ReheatCachePlugin
