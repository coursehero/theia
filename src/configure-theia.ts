import Theia from './theia'
import S3StoragePlugin from './plugins/s3-storage-plugin'
import LocalStoragePlugin from './plugins/local-storage-plugin'
import BuildPlugin from './plugins/build-plugin'
import RollbarPlugin from './plugins/rollbar-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import AuthPlugin from './plugins/auth-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import UsagePlugin from './plugins/usage-plugin'
import * as path from 'path'

const FIVE_MINUTES = 1000 * 60 * 5

let storagePlugin
if (process.env.THEIA_LOCAL_STORAGE === '1') {
  storagePlugin = new LocalStoragePlugin(path.resolve(__dirname, '..', 'libs'))
} else {
  storagePlugin = new S3StoragePlugin('coursehero-dev-pub', 'theia')
}

const theia = new Theia(
  {
    configPath: path.resolve(__dirname, '..', 'theia.config.json'),
    localConfigPath: path.resolve(__dirname, '..', 'theia.local.config.json'),
    plugins: [
      storagePlugin,
      new BuildPlugin(FIVE_MINUTES),
      new RollbarPlugin(),
      new ReheatCachePlugin(),
      new HeartbeatPlugin(),
      new AuthPlugin('CH-Auth', 'courseherobatman'),
      new UsagePlugin()
    ]
  }
)

export default theia
