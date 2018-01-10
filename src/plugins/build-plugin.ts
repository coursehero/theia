import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as fs from 'fs-extra'
import * as path from 'path'
import { exec as __exec } from 'child_process'

function promiseExec (cmd: string, opts = {}) {
  return new Promise((resolve, reject) =>
    __exec(cmd, opts, (err, stdout) => {
      if (err) {
        reject(err)
        return
      }

      resolve(stdout)
    })
  )
}

class BuildPlugin implements TheiaPlugin {
  buildInterval: number

  constructor (buildInterval: number) {
    this.buildInterval = buildInterval
  }

  apply (theia: Theia) {
    theia.hooks.start.tap('BuildPlugin', this.onStart.bind(this))
  }

  onStart (theia: Theia) {
    this.buildAll(theia)
    setInterval(() => this.buildAll(theia), this.buildInterval)
  }

  buildAll (theia: Theia) {
    const projectRootDir = path.resolve(__dirname, '..', '..')

    async function buildFromDir (componentLibrary: string, workingDir: string, branch: string): Promise<void> {
      console.log(`${componentLibrary}: checking for updates in ${workingDir} ...`)

      await promiseExec(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })

      const commitHash = (await promiseExec(`git rev-parse HEAD`, { cwd: workingDir })).toString().trim()

      if (await hasBuilt(componentLibrary, commitHash)) {
        console.log(`${componentLibrary}: no updates found`)
        return Promise.resolve()
      }

      console.log(`${componentLibrary}: building commit hash ${commitHash} ...`)

      const statsFilename = `stats.${commitHash}.json`
      await promiseExec(`yarn install --production=false --non-interactive && rm -rf dist && mkdir dist && ./node_modules/.bin/webpack --json > dist/${statsFilename}`, { cwd: workingDir })
      const workingDistDir = path.resolve(workingDir, 'dist')

      return fs.readdir(workingDistDir).then(buildAssetBasenames => {
        return buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))
      }).then(buildAssets => {
        return theia.registerComponentLibrary(componentLibrary, buildAssets, commitHash)
      }).then(() => {
        console.log(`${componentLibrary}: built ${commitHash}`)
      })
    }

    async function ensureRepoIsCloned (componentLibrary: string, repoSource: string): Promise<string> {
      const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

      const exists = await fs.pathExists(workingDir)
      if (!exists) {
        await promiseExec(`git clone ${repoSource} ${workingDir}`)
      }

      return Promise.resolve(workingDir)
    }

    function hasBuilt (componentLibrary: string, commitHash: string): Promise<boolean> {
      return theia.hasBuildManifest(componentLibrary).then(result => {
        if (!result) return false
        return theia.getBuildManifest(componentLibrary).then(buildManifest => {
          return buildManifest.some(entry => entry.commitHash === commitHash)
        })
      })
    }

    const environment: ('development' | 'production') = (process.env.NODE_ENV as 'development' | 'production') || 'development'
    const libs = theia.config.libs

    console.log('building component libraries ...')

    Promise.all(Object.keys(libs).map(async (componentLibrary) => {
      const componentLibraryConfig = libs[componentLibrary]
      const branch = componentLibraryConfig[environment].branch
      const workingDir = await ensureRepoIsCloned(componentLibrary, componentLibraryConfig.source)
      return buildFromDir(componentLibrary, workingDir, branch)
    })).then(() => {
      console.log('finished building component libraries')
    }).catch(errors => {
      console.log('errors building component libraries')
      console.log(errors)
    })
  }
}

export default BuildPlugin
