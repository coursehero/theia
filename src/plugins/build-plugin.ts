import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as fs from 'fs-extra'
import * as path from 'path'
import { execSync } from 'child_process' // TODO: don't use Sync

class BuildPlugin implements TheiaPlugin {
  apply (theia: Theia) {
    theia.hooks.start.tap('BuildPlugin', this.onStart.bind(this))
  }

  onStart (theia: Theia) {
    this.buildAll(theia)

    const FIVE_MINUTES = 1000 * 60 * 5
    setInterval(() => this.buildAll(theia), FIVE_MINUTES)
  }

  buildAll (theia: Theia) {
    const projectRootDir = path.resolve(__dirname, '..', '..')

    async function buildFromDir (componentLibrary: string, workingDir: string, branch: string) {
      console.log(`${componentLibrary}: checking for updates in ${workingDir} ...`)

      execSync(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })

      const commitHash = execSync(`git rev-parse HEAD`, { cwd: workingDir }).toString().trim()

      if (await hasBuilt(componentLibrary, commitHash)) {
        console.log(`${componentLibrary}: no updates found`)
        return Promise.resolve()
      }

      console.log(`${componentLibrary}: building commit hash ${commitHash} ...`)

      const statsFilename = `stats.${commitHash}.json`
      execSync(`yarn install --production=false --non-interactive && rm -rf dist && mkdir dist && ./node_modules/.bin/webpack --json > dist/${statsFilename}`, { cwd: workingDir })
      const workingDistDir = path.resolve(workingDir, 'dist')

      return fs.readdir(workingDistDir).then(buildAssetBasenames => {
        return buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))
      }).then(buildAssets => {
        return theia.registerComponentLibrary(componentLibrary, buildAssets, commitHash)
      }).then(() => {
        console.log(`${componentLibrary}: built ${commitHash}`)
      })
    }

    function ensureRepoIsCloned (componentLibrary: string, repoSource: string) {
      const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

      if (!fs.existsSync(workingDir)) {
        execSync(`git clone ${repoSource} ${workingDir}`)
      }

      return workingDir
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

    Promise.all(Object.keys(libs).map(componentLibrary => {
      const componentLibraryConfig = libs[componentLibrary]
      const branch = componentLibraryConfig[environment].branch
      const workingDir = ensureRepoIsCloned(componentLibrary, componentLibraryConfig.source)
      return buildFromDir(componentLibrary, workingDir, branch)
    })).then(() => {
      console.log('finished building component libraries')
      return
    }).catch(errors => {
      console.log('errors building component libraries')
      console.log(errors)
    })
  }
}

export default BuildPlugin
