import * as debug from 'debug'
import * as fs from 'fs-extra'
import * as path from 'path'
import { exec as __exec } from 'child_process'

// const logger = debug('theia:builder')
// logger.log = console.log.bind(console)

// const loggerErr = debug('theia:builder')

function promiseExec (cmd: string, opts = {}, logger: debug.IDebugger, loggerErr: debug.IDebugger): Promise<string> {
  logger(`running '${cmd}' with options ${JSON.stringify(opts)}`)
  const child = __exec(cmd, opts)

  let stdOutResult = ''
  child.stdout.on('data', function (data: string) {
    stdOutResult += data
    logger(data.trim())
  })

  let stdErrResult = ''
  child.stderr.on('data', function (data: string) {
    stdErrResult += data
    loggerErr(data.trim())
  })

  return new Promise(function (resolve, reject) {
    child.addListener('error', reject)
    child.addListener('exit', (code: number) => {
      if (code === 0) {
        resolve(stdOutResult.trim())
      } else {
        reject(stdErrResult.trim())
      }
    })
  })
}

type WrapPromiseExecLoggersReturn = (cmd: string, opts?: {}) => Promise<string>
function wrapPromiseExecLoggers(logger: debug.IDebugger, loggerErr: debug.IDebugger): WrapPromiseExecLoggersReturn {
  return (cmd: string, opts = {}) => promiseExec(cmd, opts, logger, loggerErr)
}

class Builder implements Theia.Builder {
  async build (core: Theia.Core, componentLibrary: string, componentLibraryConfig: Theia.ComponentLibraryConfiguration) {
    // the latest commit in the tracked branch will be persisted
    const branch = componentLibraryConfig.branches[core.environment]
    const workingDir = await this.ensureRepoIsClonedAndUpdated(componentLibrary, componentLibraryConfig.source, branch)

    return this.buildFromDir(core, componentLibrary, workingDir)
  }

  async buildFromDir (core: Theia.Core, componentLibrary: string, workingDir: string): Promise<void> {
    const loggerErr = debug(`theia:builder ${componentLibrary}`)
    const logger = debug(`theia:builder ${componentLibrary}`)
    logger.log = console.log.bind(console)
    const doPromiseExec = wrapPromiseExecLoggers(logger, loggerErr)

    logger(`checking for updates in ${workingDir} ...`)

    const commitHash = await doPromiseExec(`git rev-parse HEAD`, { cwd: workingDir })
    if (commitHash && await this.hasBuilt(core, componentLibrary, commitHash)) {
      logger(`no updates found`)
      return
    }

    const commitMessage = (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%s`, { cwd: workingDir }))
    const author = {
      name: (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%aN`, { cwd: workingDir })),
      email: (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%ae`, { cwd: workingDir }))
    }

    logger(`building ${commitHash} ...`)

    const workingDistDir = path.resolve(workingDir, 'dist')

    await doPromiseExec('yarn install --production=false --non-interactive', { cwd: workingDir })
    await doPromiseExec('rm -rf dist && mkdir dist', { cwd: workingDir })

    const componentLibraryPackage = require(path.resolve(workingDir, 'package.json'))

    // If build command exists, use it. It is assumed that it pipes the webpack stats file to "dist/stats.json"
    const buildCommand = componentLibraryPackage.scripts.build ?
                          'yarn build' :
                          `./node_modules/.bin/webpack --json > dist/stats.json`
    await doPromiseExec(buildCommand, { cwd: workingDir }).catch(err => {
      // webpack does not send errors to stdout when using "--json"
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
      logger(`running tests`)
      await promiseExec('yarn test', { cwd: workingDir }, logger, loggerErr)
      logger(`finished tests`)
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
      logger(`built ${commitHash}`)
    })
  }

  async ensureRepoIsClonedAndUpdated (componentLibrary: string, repoSource: string, branch: string): Promise<string> {
    const loggerErr = debug(`theia:builder ${componentLibrary}`)
    const logger = debug(`theia:builder ${componentLibrary}`)
    logger.log = console.log.bind(console)
    const doPromiseExec = wrapPromiseExecLoggers(logger, loggerErr)

    const projectRootDir = path.resolve(__dirname, '..')
    const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

    const exists = await fs.pathExists(workingDir)
    if (!exists) {
      await doPromiseExec(`git clone ${repoSource} ${workingDir}`)
    }

    await doPromiseExec(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })

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
