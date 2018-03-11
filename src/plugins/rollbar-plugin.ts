import * as Rollbar from 'rollbar'
import * as XXHash from 'xxhash'

export interface HashCache {
  [key: string]: number[]
}

const FIVE_MINUTES = 1000 * 60 * 5
const ONE_HOUR = 1000 * 60 * 60

const REPEAT_RENDER_REQUEST_ERROR_THRESHOLD = 10
const PRUNE_INTERVAL = FIVE_MINUTES
const CACHE_TTL = ONE_HOUR

class RollbarPlugin implements Theia.Plugin {
  rollbar: any
  hashCache: HashCache = {}

  constructor (accessToken: string, environment: string) {
    this.rollbar = new Rollbar({
      accessToken,
      environment
    })
  }

  apply (core: Theia.Core) {
    core.hooks.beforeRender.tap('RollbarPlugin', this.onBeforeRender.bind(this))
    core.hooks.error.tap('RollbarPlugin', this.onError.bind(this))
    core.hooks.start.tap('RollbarPlugin', this.onStart.bind(this))
  }

  // before render, because props can possibly be modified during render
  onBeforeRender (core: Theia.Core, componentLibrary: string, component: string, props: object) {
    // create errors if the same component/props is rendered repeatedly, which suggests a cache failure

    // TODO: maybe only enable in production ?
    // const enabled = process.env.THEIA_ENV === 'production'
    const enabled = true

    if (enabled) {
      const data = componentLibrary + component + JSON.stringify(props)
      const hash = XXHash.hash(Buffer.from(data, 'utf-8'), 0)

      if (!(hash in this.hashCache)) {
        this.hashCache[hash] = []
      }

      this.hashCache[hash].push(Date.now())

      if (this.hashCache[hash].length > REPEAT_RENDER_REQUEST_ERROR_THRESHOLD) {
        this.rollbar.error(`Wendigo - Excessive consumption noticed. Received many render requests for ${data}. Verify requests are being cached correctly.`)
      }
    }
  }

  onError (core: Theia.Core, error: Theia.ResponseError) {
    this.rollbar.error(error)
  }

  onStart (core: Theia.Core) {
    setInterval(() => this.pruneHashCache(), PRUNE_INTERVAL)
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
