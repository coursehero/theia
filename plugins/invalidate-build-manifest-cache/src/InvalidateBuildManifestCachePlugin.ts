import { BuildManifest, Core, CoreHooks, Plugin } from '@coursehero/theia'

// when the build service runs, it updates the build-manifest in storage (S3)
// the other instances of Theia (the ones that actualy render requests) won't get the new manifest b/c of internal caching
// for now, just clear the cache periodically
// a real solution is to have the build service alert the render services when a build has occurred

function buildManifestsAreSame (bm1: BuildManifest, bm2: BuildManifest) {
  if (!bm1.length && !bm2.length) return true
  if (bm1.length !== bm2.length) return false
  if (bm1[bm1.length - 1].commitHash !== bm2[bm2.length - 1].commitHash) return false

  return true
}

class InvalidateBuildManifestCachePlugin implements Plugin {
  constructor (public invalidationInterval: number) {}

  apply (core: Core) {
    core.hooks.start.tapPromise('InvalidateBuildManifestCachePlugin', this.onStart)
  }

  onStart = ({ core }: CoreHooks.OnStartArgs) => {
    this.checkForUpdates(core, this.invalidationInterval).catch(err => {
      core.logError('theia:InvalidateBuildManifestCachePlugin', err)
    })

    return Promise.resolve()
  }

  checkForUpdates (core: Core, delay: number): Promise<void> {
    return Promise.resolve()
      .then(() => new Promise(function (resolve) {
        setTimeout(resolve, delay)
      }))
      .then(async () => {
        for (const componentLibrary in core.libs) {
          const hasBuildManifest = await core.hasBuildManifest(componentLibrary)
          if (!hasBuildManifest) {
            return
          }

          const cachedBuildManifest = await core.getBuildManifest(componentLibrary)
          const actualBuildManifest = JSON.parse(await core.storage.load(componentLibrary, 'build-manifest.json'))
          if (!buildManifestsAreSame(cachedBuildManifest, actualBuildManifest)) {
            core.log('theia:InvalidateBuildManifestCachePlugin', `clearing cache for ${componentLibrary} ...`)
            core.clearCache(componentLibrary)

            // fill cache
            await core.getComponentLibrary(componentLibrary)
          }
        }
      }).then(() => this.checkForUpdates(core, delay))
  }
}

export default InvalidateBuildManifestCachePlugin
