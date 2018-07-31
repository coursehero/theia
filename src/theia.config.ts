import * as path from 'path'
import * as theia from './theia'

const FIVE_MINUTES = 1000 * 60 * 5
const useLocalStorage = process.env.THEIA_LOCAL === '1' || process.env.THEIA_LOCAL_STORAGE === '1'
const enablePeriodicBuilding = process.env.THEIA_LOCAL === '1' || process.env.THEIA_LOCAL_BUILD === '1'

let storage: theia.Storage
if (useLocalStorage) {
  storage = new theia.LocalStorage(path.resolve(__dirname, '..', 'libs'))
} else {
  storage = new theia.S3Storage(
    process.env.THEIA_S3_BUCKET || 'coursehero_dev',
    process.env.THEIA_S3_BUCKET_FOLDER || 'theia'
  )
}

// const useUniqueQueue = (componentLibrary: string) => {
//   const cleaned = componentLibrary.replace(/@/g, '')
//   return process.env.THEIA_ENV === 'production' ? `Theia_${cleaned}` : `Theia_${cleaned}_dev`
// }
const defaultQueue = process.env.THEIA_ENV === 'production' ? 'TheiaReheatJobs' : 'TheiaReheatJobs_dev'

const plugins: theia.Plugin[] = theia.nn([
  process.env.THEIA_ROLLBAR_TOKEN ? new theia.RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN, process.env.ROLLBAR_ENV!) : null,
  process.env.SLACK_TOKEN ? new theia.SlackPlugin({
    channel: process.env.THEIA_ENV === 'production' ? '#theia-prod' : '#theia-dev'
  }) : null,
  enablePeriodicBuilding ? new theia.BuildPlugin(FIVE_MINUTES) : null,
  new theia.InvalidateBuildManifestCachePlugin(5000), // the DelaySeconds param on 'new-build-job' should compensate for this
  process.env.THEIA_CACHE ? new theia.CachePlugin({
    '@coursehero/study-guides': {
      strategy: 'new-build-job',
      queue: defaultQueue
    }
  }) : null,
  new theia.ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000),
  new theia.HeartbeatPlugin(),
  process.env.THEIA_AUTH_SECRET ? new theia.AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET) : null,
  new theia.UsagePlugin()
])

const libs: theia.ComponentLibraryConfigurations = {
  '@coursehero/study-guides': {
    source: 'git@git.coursehero.com:coursehero/components/study-guides.git',
    env: {
      development: 'dev',
      production: 'master'
    }
  },
  '@coursehero/mythos': {
    source: 'https://github.com/theiajs/mythos.git',
    env: {
      development: 'dev',
      production: 'master'
    }
  }
}

const config: theia.Configuration = {
  libs,
  plugins,
  storage
}

export default config
