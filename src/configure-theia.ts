import Theia from './theia'
import LocalStoragePlugin from './plugins/local-storage-plugin'
import BuildPlugin from './plugins/build-plugin'
import RollbarPlugin from './plugins/rollbar-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import AuthPlugin from './plugins/auth-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import UsagePlugin from './plugins/usage-plugin'
import * as path from 'path'

const theia = new Theia(
  {
    configPath: path.resolve(__dirname, '..', 'theia.config.json'),
    localConfigPath: path.resolve(__dirname, '..', 'theia.local.config.json'),
    plugins: [
      new LocalStoragePlugin(path.resolve(__dirname, '..', 'libs')),
      new BuildPlugin(),
      new RollbarPlugin(),
      new ReheatCachePlugin(),
      new HeartbeatPlugin(),
      new AuthPlugin('CH-Auth', 'courseherobatman'),
      new UsagePlugin()
    ]
  }
)

export default theia
