import * as path from 'path'
import Core from './core'
import LocalStorage from './local-storage'
import S3Storage from './s3-storage'
import AuthPlugin from './plugins/auth-plugin'
import BuildPlugin from './plugins/build-plugin'
import ExpressPlugin from './plugins/express-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import InvalidateBuildManifestCachePlugin from './plugins/invalidate-build-manifest-cache-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import RollbarPlugin from './plugins/rollbar-plugin'
import UsagePlugin from './plugins/usage-plugin'

const ONE_MINUTE = 1000 * 60
const FIVE_MINUTES = 1000 * 60 * 5
const useLocalStorage = process.env.THEIA_LOCAL === '1' || process.env.THEIA_LOCAL_STORAGE === '1'
const useLocalConfig = process.env.THEIA_LOCAL === '1' || process.env.THEIA_LOCAL_CONFIG === '1'
const enablePeriodicBuilding = process.env.THEIA_LOCAL === '1' || process.env.THEIA_BUILD === '1'

// no nulls
function nn<T> (array: (T | null)[]): T[] {
  return array.filter(e => e !== null) as T[]
}

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
  const localConfig = getConfig(path.resolve(__dirname, '..', 'theia.local.config.json'))
  config = mergeConfigs(config, localConfig)
}

let storage
if (useLocalStorage) {
  storage = new LocalStorage(path.resolve(__dirname, '..', 'libs'))
} else {
  storage = new S3Storage(
    process.env.THEIA_S3_BUCKET || 'coursehero_dev',
    process.env.THEIA_S3_BUCKET_FOLDER || 'theia'
  )
}

const plugins = nn<Theia.Plugin>([
  process.env.THEIA_ROLLBAR_TOKEN ? new RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN!, process.env.ROLLBAR_ENV!) : null,
  enablePeriodicBuilding ? new BuildPlugin(FIVE_MINUTES) : null,
  new InvalidateBuildManifestCachePlugin(ONE_MINUTE), // temporary. TODO: remove. see impl. file
  new ReheatCachePlugin(),
  new ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT!, 10) : 3000),
  new HeartbeatPlugin(),
  process.env.THEIA_AUTH_SECRET ? new AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET!) : null,
  new UsagePlugin()
])

if (useLocalConfig) {
  console.log('*************************')
  console.log('USING LOCAL CONFIGURATION')
  console.log('*************************')
}
console.log(JSON.stringify(config, null, 2))
console.log(plugins.map(p => p.constructor.name).join(' '))
console.log(storage.constructor.name)

const theia = new Core({
  config,
  plugins,
  storage
})

export default theia
