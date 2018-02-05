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

    async function buildFromDir (componentLibrary: string, workingDir: string, commitHash: string | undefined): Promise<void> {
      console.log(`${componentLibrary}: checking for updates in ${workingDir} ...`)

      if (commitHash && await hasBuilt(componentLibrary, commitHash)) {
        console.log(`${componentLibrary}: no updates found`)
        return
      }

      const tag = commitHash || 'local'

      console.log(`${componentLibrary}: building ${tag} ...`)

      const statsFilename = `stats.${tag}.json`
      const workingDistDir = path.resolve(workingDir, 'dist')

      await promiseExec('yarn install --production=false --non-interactive', { cwd: workingDir })
      await promiseExec('rm -rf dist && mkdir dist', { cwd: workingDir })

      await promiseExec(`./node_modules/.bin/webpack --json > dist/${statsFilename}`, { cwd: workingDir }).catch(err => {
        // webpack does not send error to stdout when using "--json"
        // instead, it puts it in the json output
        const statsPath = path.join(workingDir, 'dist', statsFilename)
        if (fs.pathExistsSync(statsPath)) {
          const stats = require(statsPath)
          if (stats.errors && stats.errors.length) {
            throw new Error(stats.errors.join('\n====\n'))
          }
        }

        throw err
      })

      return fs.readdir(workingDistDir).then(buildAssetBasenames => {
        return buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))
      }).then(buildAssets => {
        return theia.registerComponentLibrary(componentLibrary, buildAssets, tag)
      }).then(() => {
        console.log(`${componentLibrary}: built ${tag}`)
      })
    }

    async function ensureRepoIsClonedAndUpdated (componentLibrary: string, repoSource: string, branch: string): Promise<string> {
      const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

      const exists = await fs.pathExists(workingDir)
      if (!exists) {
        await promiseExec(`git clone ${repoSource} ${workingDir}`)
      }

      await promiseExec(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })

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

    Promise.all(Object.keys(libs).map(async (componentLibrary) => {
      const componentLibraryConfig = libs[componentLibrary]
      const branch = componentLibraryConfig[environment].branch

      if (componentLibraryConfig.source.startsWith('git@')) {
        // source is a git protocol. this is a normal build. the latest commit in the tracked branch will be persisted
        const workingDir = await ensureRepoIsClonedAndUpdated(componentLibrary, componentLibraryConfig.source, branch)
        const commitHash = (await promiseExec(`git rev-parse HEAD`, { cwd: workingDir })).toString().trim()
        return buildFromDir(componentLibrary, workingDir, commitHash)
      } else {
        // source is a local folder. this is for local testing. it will use the contents of the source folder directly, instead of the latest commit
        return buildFromDir(componentLibrary, componentLibraryConfig.source, undefined)
      }
    })).then(() => {
      console.log('finished building component libraries')
    }).catch(errors => {
      console.log('errors building component libraries')
      console.log(errors)
    })
  }
}

export default BuildPlugin
