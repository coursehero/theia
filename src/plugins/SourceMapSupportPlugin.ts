import { Core, CoreHooks, Plugin } from '../theia'

class SourceMapSupportPlugin implements Plugin {
  sourceMaps: {
    [source: string]: string
  } = {}

  apply (core: Core) {
    core.hooks.start.tapPromise('SourceMapSupportPlugin', this.onStart)
    core.hooks.componentLibraryLoad.tapPromise('SourceMapSupportPlugin', this.onComponentLibraryLoad)
  }

  onStart = ({ core }: CoreHooks.OnStartArgs) => {
    require('../../source-map-support').install({
      retrieveSourceMap: (source: string) => {
        if (this.sourceMaps[source]) {
          return {
            url: source.replace('.js', '.ts'),
            map: this.sourceMaps[source]
          }
        }

        return null
      }
    })

    return Promise.resolve()
  }

  onComponentLibraryLoad = async ({ core, componentLibrary, manifestEntry }: CoreHooks.OnComponentLibraryLoadArgs) => {
    const stats = (await core.getLatestStatsContents(componentLibrary)).node
    const jsAssets = stats.assets.filter(a => a.name.endsWith('.js')).map(a => a.name)
    for (const asset of jsAssets) {
      const sourceMapAsset = asset + '.map'
      if (await core.storage.exists(componentLibrary, sourceMapAsset)) {
        const sourceMap = await core.storage.load(componentLibrary, sourceMapAsset)
        this.sourceMaps[`${componentLibrary}/${asset}`] = sourceMap
      }
    }
  }
}

export default SourceMapSupportPlugin
