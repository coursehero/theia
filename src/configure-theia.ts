import * as path from 'path'
import Theia from './theia'
import S3StoragePlugin from './plugins/s3-storage-plugin'
import LocalStoragePlugin from './plugins/local-storage-plugin'
import BuildPlugin from './plugins/build-plugin'
import RollbarPlugin from './plugins/rollbar-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import AuthPlugin from './plugins/auth-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import UsagePlugin from './plugins/usage-plugin'

const FIVE_MINUTES = 1000 * 60 * 5
const useLocalStorage = process.env.THEIA_LOCAL === '1' || process.env.THEIA_LOCAL_STORAGE === '1'
const useLocalConfig = process.env.THEIA_LOCAL === '1' || process.env.THEIA_LOCAL_CONFIG === '1'

function getConfig (configPath: string): Theia.Configuration {
  return require(configPath)
}

function mergeConfigs (config1: Theia.Configuration, config2: Theia.Configuration): Theia.Configuration {
  const config = JSON.parse(JSON.stringify(config1))

  for (const componentLibrary in config2.libs) {
    const config1ComponentLibrary = config1.libs[componentLibrary]
    const config2ComponentLibrary = config2.libs[componentLibrary]

    config.libs[componentLibrary] = Object.assign({}, config1ComponentLibrary, config2ComponentLibrary)
  }

  return config
}

let config = getConfig(path.resolve(__dirname, '..', 'theia.config.json'))
if (useLocalConfig) {
  console.log('*************************')
  console.log('USING LOCAL CONFIGURATION')
  console.log('*************************')

  const localConfig = getConfig(path.resolve(__dirname, '..', 'theia.local.config.json'))
  config = mergeConfigs(config, localConfig)
}

let storagePlugin
if (useLocalStorage) {
  storagePlugin = new LocalStoragePlugin(path.resolve(__dirname, '..', 'libs'))
} else {
  storagePlugin = new S3StoragePlugin('coursehero-dev-pub', 'theia')
}

const plugins: Array<Theia.Plugin> = [
  storagePlugin,
  new BuildPlugin((process.env.NODE_ENV as Theia.Environment) || 'development', FIVE_MINUTES),
  new ReheatCachePlugin(),
  new HeartbeatPlugin(),
  new AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET || 'courseherobatman'),
  new UsagePlugin()
]

if (process.env.THEIA_ROLLBAR_TOKEN) {
  plugins.push(new RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN as string, process.env.ROLLBAR_ENV as string))
}

console.log(plugins)
console.log(JSON.stringify(config, null, 2))

const theia = new Theia(
  {
    config,
    plugins
  }
)

export default theia
