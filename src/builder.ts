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

class Builder implements Theia.Builder {
  async build (core: Theia.Core, componentLibraryConfig: Theia.ComponentLibraryConfiguration) {
    const componentLibrary = componentLibraryConfig.name
    const branch = componentLibraryConfig.branches[core.environment]

    if (componentLibraryConfig.source.startsWith('git@')) {
      // source is a git protocol. this is a normal build. the latest commit in the tracked branch will be persisted
      const workingDir = await this.ensureRepoIsClonedAndUpdated(componentLibrary, componentLibraryConfig.source, branch)
      const commitHash = (await promiseExec(`git rev-parse HEAD`, { cwd: workingDir })).toString().trim()
      return this.buildFromDir(core, componentLibrary, workingDir, commitHash)
    } else {
      // source is a local folder. this is for local testing. it will use the contents of the source folder directly, instead of the latest commit
      return this.buildFromDir(core, componentLibrary, componentLibraryConfig.source, undefined)
    }
  }

  async buildFromDir (core: Theia.Core, componentLibrary: string, workingDir: string, commitHash?: string): Promise<void> {
    console.log(`${componentLibrary}: checking for updates in ${workingDir} ...`)

    if (commitHash && await this.hasBuilt(core, componentLibrary, commitHash)) {
      console.log(`${componentLibrary}: no updates found`)
      return
    }

    const tag = commitHash || 'local'

    console.log(`${componentLibrary}: building ${tag} ...`)

    const workingDistDir = path.resolve(workingDir, 'dist')

    // if THEIA_LOCAL=1, node_modules for a CL could have been volume mapped into the container. Those modules would have been installed
    // from the host machine, which does not match the container environment. Must explicitly delete folder.
    if (tag === 'local') {
      await promiseExec('rm -rf node_modules/', { cwd: workingDir })
    }

    await promiseExec('yarn install --production=false --non-interactive', { cwd: workingDir })
    await promiseExec('rm -rf dist && mkdir dist', { cwd: workingDir })

    const componentLibraryPackage = require(path.resolve(workingDir, 'package.json'))

    // If build command exists, use it. It is assumed that it pipes the webpack stats file to "dist/stats.json"
    const buildCommand = componentLibraryPackage.scripts.build ?
                          'yarn run build' :
                          `./node_modules/.bin/webpack --json > dist/stats.json`
    await promiseExec(buildCommand, { cwd: workingDir }).catch(err => {
      // webpack does not send error to stdout when using "--json"
      // instead, it puts it in the json output
      const statsPath = path.join(workingDir, 'dist', 'stats.json')
      if (fs.pathExistsSync(statsPath)) {
        const stats = require(statsPath)
        if (stats.errors && stats.errors.length) {
          throw new Error(stats.errors.join('\n====\n'))
        }
      }

      throw err
    })

    const statsFilename = `stats.${tag}.json`
    fs.renameSync(path.join(workingDir, 'dist', 'stats.json'), path.join(workingDir, 'dist', statsFilename))

    if (componentLibraryPackage.scripts.test) {
      await promiseExec('yarn run test', { cwd: workingDir })
    }

    return fs.readdir(workingDistDir).then(buildAssetBasenames => {
      return buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))
    }).then(buildAssets => {
      return core.registerComponentLibrary(componentLibrary, buildAssets, tag)
    }).then(() => {
      console.log(`${componentLibrary}: built ${tag}`)
    })
  }

  async ensureRepoIsClonedAndUpdated (componentLibrary: string, repoSource: string, branch: string): Promise<string> {
    const projectRootDir = path.resolve(__dirname, '..')
    const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

    const exists = await fs.pathExists(workingDir)
    if (!exists) {
      await promiseExec(`git clone ${repoSource} ${workingDir}`)
    }

    await promiseExec(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })

    return workingDir
  }

  hasBuilt (core: Theia.Core, componentLibrary: string, commitHash: string): Promise<boolean> {
    return core.hasBuildManifest(componentLibrary).then(result => {
      if (!result) return false
      return core.getBuildManifest(componentLibrary).then(buildManifest => {
        return buildManifest.some(entry => entry.commitHash === commitHash)
      })
    })
  }
}

export default Builder
