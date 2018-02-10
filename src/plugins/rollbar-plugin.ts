import Theia from '../theia'
import * as Rollbar from 'rollbar'
import * as XXHash from 'xxhash'

interface ResponseError extends Error {
  status?: number
}

interface HashCache {
  [key: string]: Array<number>
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

  apply (theia: Theia) {
    theia.hooks.error.tap('RollbarPlugin', this.onError.bind(this))
    theia.hooks.beforeRender.tap('RollbarPlugin', this.onBeforeRender.bind(this))

    setInterval(() => this.pruneHashCache(), PRUNE_INTERVAL)
  }

  onError (theia: Theia, error: ResponseError) {
    this.rollbar.error(error)
  }

  // before render, because props can possibly be modified during render
  onBeforeRender (theia: Theia, componentLibrary: string, component: string, props: object) {
    // create errors if the same component/props is rendered repeatedly, which suggests a cache failure

    // TODO: maybe only enable in production ?
    // const enabled = process.env.NODE_ENV === 'production'
    const enabled = true

    if (enabled) {
      const data = componentLibrary + component + JSON.stringify(props)
      const hash = XXHash.hash(Buffer.from(data, 'utf-8'), 0)

      if (!(hash in this.hashCache)) {
        this.hashCache[hash] = []
      }

      this.hashCache[hash].push(Date.now())

      if (this.hashCache[hash].length > REPEAT_RENDER_REQUEST_ERROR_THRESHOLD) {
        this.rollbar.error(`Potential cache failure: seeing many render requests for ${data}`)
      }
    }
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
