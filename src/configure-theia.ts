import Theia from './theia'
import BuildPlugin from './plugins/build-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import AuthPlugin from './plugins/auth-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import UsagePlugin from './plugins/usage-plugin'
import * as path from 'path'

const theia = new Theia(
  {
    configPath: path.resolve(__dirname, '..', 'theia.config.json'),
    localConfigPath: path.resolve(__dirname, '..', 'theia.local.config.json'),
    buildManifestPath: path.resolve(__dirname, '..', 'libs', 'build-manifest.json'),
    plugins: [
      new BuildPlugin(),
      new ReheatCachePlugin(),
      new AuthPlugin('courseherobatman'),
      new HeartbeatPlugin(),
      new UsagePlugin()
    ]
  }
)

export default theia
