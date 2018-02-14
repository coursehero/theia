import {
  default as Theia,
  TheiaPlugin
} from './theia'
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
if (process.env.THEIA_LOCAL === '1') {
  storagePlugin = new LocalStoragePlugin(path.resolve(__dirname, '..', 'libs'))
} else {
  storagePlugin = new S3StoragePlugin('coursehero-dev-pub', 'theia')
}

const plugins: Array<TheiaPlugin> = [
  storagePlugin,
  new BuildPlugin(FIVE_MINUTES),
  new ReheatCachePlugin(process.env.THEIA_SQS_REHEAT_CACHE_URL as string),
  new HeartbeatPlugin(),
  new AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET || 'courseherobatman'),
  new UsagePlugin()
]

if (process.env.THEIA_ROLLBAR_TOKEN) {
  plugins.push(new RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN as string, process.env.ROLLBAR_ENV as string))
}

console.log(plugins)

const theia = new Theia(
  {
    configPath: path.resolve(__dirname, '..', 'theia.config.json'),
    localConfigPath: path.resolve(__dirname, '..', 'theia.local.config.json'),
    plugins
  }
)

export default theia
