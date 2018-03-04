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
    // the latest commit in the tracked branch will be persisted
    const componentLibrary = componentLibraryConfig.name
    const branch = componentLibraryConfig.branches[core.environment]
    const workingDir = await this.ensureRepoIsClonedAndUpdated(componentLibrary, componentLibraryConfig.source, branch)

    return this.buildFromDir(core, componentLibrary, workingDir)
  }

  async buildFromDir (core: Theia.Core, componentLibrary: string, workingDir: string): Promise<void> {
    console.log(`${componentLibrary}: checking for updates in ${workingDir} ...`)

    const commitHash = (await promiseExec(`git rev-parse HEAD`, { cwd: workingDir })).toString().trim()
    if (commitHash && await this.hasBuilt(core, componentLibrary, commitHash)) {
      console.log(`${componentLibrary}: no updates found`)
      return
    }

    const commitMessage = (await promiseExec(`git log -1 ${commitHash} --pretty=format:%s`, { cwd: workingDir })).toString().trim()
    const author = {
      name: (await promiseExec(`git log -1 ${commitHash} --pretty=format:%aN`, { cwd: workingDir })).toString().trim(),
      email: (await promiseExec(`git log -1 ${commitHash} --pretty=format:%ae`, { cwd: workingDir })).toString().trim()
    }

    console.log(`${componentLibrary}: building ${commitHash} ...`)

    const workingDistDir = path.resolve(workingDir, 'dist')

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

    if (!fs.existsSync(path.join(workingDir, 'dist', 'stats.json'))) {
      throw new Error(`Building ${componentLibrary} did not emit a stats file`)
    }

    const statsFilename = `stats.${commitHash}.json`
    fs.renameSync(path.join(workingDir, 'dist', 'stats.json'), path.join(workingDir, 'dist', statsFilename))

    if (componentLibraryPackage.scripts.test) {
      await promiseExec('yarn run test', { cwd: workingDir })
    }

    return fs.readdir(workingDistDir).then(buildAssetBasenames => {
      return buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))
    }).then(buildAssets => {
      const buildManifestEntry = {
        commitHash,
        commitMessage,
        author,
        stats: statsFilename,
        createdAt: new Date().toString()
      }

      return core.registerComponentLibrary(componentLibrary, buildAssets, buildManifestEntry)
    }).then(() => {
      console.log(`${componentLibrary}: built ${commitHash}`)
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
