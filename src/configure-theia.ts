import Theia from './theia'
import BuildPlugin from './plugins/build-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import * as path from 'path'

const theia = new Theia(
  path.resolve(__dirname, '..', 'theia.config.json'),
  path.resolve(__dirname, '..', 'libs', 'build-manifest.json')
)

theia.hooks.start.tap("BuildPlugin", BuildPlugin)
theia.hooks.componentLibraryUpdate.tap("ReheatCachePlugin", ReheatCachePlugin)

export default theia
