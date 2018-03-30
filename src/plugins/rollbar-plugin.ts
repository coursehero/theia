import * as Rollbar from 'rollbar'
import * as XXHash from 'xxhash'
import { Core, CoreHooks, Plugin } from '../theia'

export interface HashCache {
  [key: string]: number[]
}

const FIVE_MINUTES = 1000 * 60 * 5
const ONE_HOUR = 1000 * 60 * 60

const REPEAT_RENDER_REQUEST_ERROR_THRESHOLD = 10
const PRUNE_INTERVAL = FIVE_MINUTES
const CACHE_TTL = ONE_HOUR

class RollbarPlugin implements Plugin {
  rollbar: Rollbar
  hashCache: HashCache = {}

  constructor (accessToken: string, environment: string) {
    this.rollbar = new Rollbar({
      accessToken,
      environment
    })
  }

  apply (core: Core) {
    core.hooks.beforeRender.tapPromise('RollbarPlugin', this.onBeforeRender)
    core.hooks.error.tapPromise('RollbarPlugin', this.onError)
    core.hooks.start.tapPromise('RollbarPlugin', this.onStart)
  }

  // create errors if the same component/props is rendered repeatedly, which suggests a cache failure
  // before render, because props can possibly be modified during render
  onBeforeRender = ({ core, componentLibrary, component, props }: CoreHooks.OnBeforeRenderArgs) => {
    const data = componentLibrary + component + JSON.stringify(props)
    const hash = XXHash.hash(Buffer.from(data, 'utf-8'), 0)

    if (!(hash in this.hashCache)) {
      this.hashCache[hash] = []
    }

    this.hashCache[hash].push(Date.now())

    if (this.hashCache[hash].length > REPEAT_RENDER_REQUEST_ERROR_THRESHOLD) {
      this.rollbar.error(`Wendigo - Excessive consumption noticed. Received many render requests for ${data}. Verify requests are being cached correctly.`)
    }

    return Promise.resolve()
  }

  onError = ({ core, error }: CoreHooks.OnErrorArgs) => {
    // tslint:disable-next-line
    return new Promise((resolve, reject) => {
      this.rollbar.error(error, err => {
        if (err) reject(err)
        resolve()
      })
    })
  }

  onStart = ({ core }: CoreHooks.OnStartArgs) => {
    setInterval(() => this.pruneHashCache(), PRUNE_INTERVAL)

    return Promise.resolve()
  }

  pruneHashCache () {
    const now = Date.now()

    for (const hash in this.hashCache) {
      // times is a sorted list of times, one for each render request in the last PRUNE_INTERVAL time
      const times = this.hashCache[hash]

      for (let i = 0; i < times.length; i++) {
        if (now - times[i] >= CACHE_TTL) {
          // times[i] is old, we should remove it
          continue
        }

        // times[i] is the first item that should NOT be removed
        times.splice(0, i)
        break
      }

      if (times.length === 0) {
        delete this.hashCache[hash]
      }
    }
  }
}

export default RollbarPlugin
