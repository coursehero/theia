import { Core, CoreHooks, Plugin } from '@coursehero/theia'
import * as XXHash from 'xxhash'

export interface HashCache {
  [key: string]: number[]
}

const FIVE_MINUTES = 1000 * 60 * 5
const ONE_HOUR = 1000 * 60 * 60

const REPEAT_RENDER_REQUEST_ERROR_THRESHOLD = 10
const PRUNE_INTERVAL = FIVE_MINUTES
const CACHE_TTL = ONE_HOUR

class WendigoPlugin implements Plugin {
  hashCache: HashCache = {}

  apply (core: Core) {
    core.hooks.beforeRender.tapPromise('WendigoPlugin', this.onBeforeRender)
    core.hooks.start.tapPromise('WendigoPlugin', this.onStart)
  }

  // create errors if the same component/props is rendered repeatedly, which suggests a cache failure
  // before render, because props can possibly be modified during render
  onBeforeRender = ({ core, req, componentLibrary, component, props }: CoreHooks.OnBeforeRenderArgs) => {
    if (!req.query.wendigo) {
      return Promise.resolve()
    }

    const data = `${componentLibrary}/${component}/${this.trimProps(props)}`
    const hash = XXHash.hash(Buffer.from(data, 'utf-8'), 0)

    if (!(hash in this.hashCache)) {
      this.hashCache[hash] = []
    }

    this.hashCache[hash].push(Date.now())

    if (this.hashCache[hash].length > REPEAT_RENDER_REQUEST_ERROR_THRESHOLD) {
      const errorMessage = `Wendigo - Excessive consumption noticed. Received many render requests for ${data}. Verify requests are being cached correctly.`
      core.logError(`theia:wendigo ${componentLibrary}`, errorMessage)
    }

    return Promise.resolve()
  }

  onStart = ({ core }: CoreHooks.OnStartArgs) => {
    setInterval(() => this.pruneHashCache(), PRUNE_INTERVAL)
    return Promise.resolve()
  }

  // for shorter error messages
  trimProps (props: object) {
    const trimmedProps: any = {}
    for (const [key, value] of Object.entries(props)) {
      trimmedProps[key] = JSON.stringify(value).substring(0, 100)
    }
    return JSON.stringify(trimmedProps)
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

export default WendigoPlugin
