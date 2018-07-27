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

const plugins: theia.Plugin[] = theia.nn([
  process.env.THEIA_ROLLBAR_TOKEN ? new theia.RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN, process.env.ROLLBAR_ENV!) : null,
  process.env.SLACK_TOKEN ? new theia.SlackPlugin({
    channel: process.env.THEIA_ENV === 'production' ? '#theia-prod' : '#theia-dev'
  }) : null,
  enablePeriodicBuilding ? new theia.BuildPlugin(FIVE_MINUTES) : null,
  new theia.InvalidateBuildManifestCachePlugin(5000), // the DelaySeconds param on 'new-build-job' should compensate for this
  process.env.THEIA_SQS_QUEUE_URL ? new theia.ReheatCachePlugin(process.env.THEIA_SQS_QUEUE_URL) : null,
  new theia.ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000),
  new theia.HeartbeatPlugin(),
  process.env.THEIA_AUTH_SECRET ? new theia.AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET) : null,
  new theia.UsagePlugin()
])

const libs: theia.ComponentLibraryConfigurations = {
  '@coursehero/study-guides': {
    source: 'git@git.coursehero.com:coursehero/components/study-guides.git',
    env: {
      development: 'v1'
    }
  },
  '@coursehero/mythos': {
    source: 'https://github.com/theiajs/mythos.git',
    env: {
      development: 'v1'
    }
  }
}

const config: theia.Configuration = {
  libs,
  plugins,
  storage
}

export default config
