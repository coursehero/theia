import { exec as __exec } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { log, logError } from './logger'
import { Builder, ComponentLibraryConfiguration, Core } from './theia'

function promiseExec (cmd: string, opts = {}, logNamespace: string): Promise<string> {
  log(logNamespace, `running '${cmd}' with options ${JSON.stringify(opts)}`)
  const child = __exec(cmd, opts)

  let stdOutResult = ''
  child.stdout.on('data', function (data: string) {
    stdOutResult += data
    log(logNamespace, data.trim())
  })

  let stdErrResult = ''
  child.stderr.on('data', function (data: string) {
    stdErrResult += data
    logError(logNamespace, data.trim())
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
function wrapPromiseExecLogNamespace (namespace: string): WrapPromiseExecLoggersReturn {
  return (cmd: string, opts = {}) => promiseExec(cmd, opts, namespace)
}

class DefaultBuilder implements Builder {
  async build (core: Core, componentLibrary: string, componentLibraryConfig: ComponentLibraryConfiguration) {
    // the latest commit in the tracked branch will be persisted
    const branch = componentLibraryConfig.branches[core.environment]
    const workingDir = await this.ensureRepoIsClonedAndUpdated(componentLibrary, componentLibraryConfig.source, branch)

    return this.buildFromDir(core, componentLibrary, workingDir)
  }

  async buildFromDir (core: Core, componentLibrary: string, workingDir: string): Promise<void> {
    const logNamespace = `theia:builder ${componentLibrary}`
    const doPromiseExec = wrapPromiseExecLogNamespace(logNamespace)

    core.log(logNamespace, `checking for updates in ${workingDir} ...`)

    const commitHash = await doPromiseExec(`git rev-parse HEAD`, { cwd: workingDir })
    if (commitHash && await this.hasBuilt(core, componentLibrary, commitHash)) {
      core.log(logNamespace, `no updates found`)
      return
    }

    const commitMessage = (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%s`, { cwd: workingDir }))
    const author = {
      name: (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%aN`, { cwd: workingDir })),
      email: (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%ae`, { cwd: workingDir }))
    }

    core.log(logNamespace, `building ${commitHash} ...`)

    const workingDistDir = path.resolve(workingDir, 'dist')

    await doPromiseExec('yarn install --production=false --non-interactive', { cwd: workingDir })
    await doPromiseExec('rm -rf dist && mkdir dist', { cwd: workingDir })

    const componentLibraryPackage = require(path.resolve(workingDir, 'package.json'))

    // If build command exists, use it
    const buildCommand = componentLibraryPackage.scripts.build ?
                          'yarn build' :
                          './node_modules/.bin/webpack --json > dist/stats-browser.json && ./node_modules/.bin/webpack --json --output-library-target commonjs2 > dist/stats-node.json'
    await doPromiseExec(buildCommand, { cwd: workingDir }).catch(err => {
      // webpack does not send errors to stdout when using "--json"
      // instead, it puts it in the json output
      const statsPaths = [path.join(workingDir, 'dist', 'stats-node.json'), path.join(workingDir, 'dist', 'stats-browser.json')]
      statsPaths.forEach(statsPath => {
        if (fs.pathExistsSync(statsPath)) {
          const stats = require(statsPath)
          if (stats.errors && stats.errors.length) {
            throw new Error(stats.errors.join('\n====\n'))
          }
        }
      })

      throw err
    })

    if (!fs.existsSync(path.join(workingDir, 'dist', 'stats-browser.json'))) {
      throw new Error(`Building ${componentLibrary} did not emit a browser stats file`)
    }

    if (!fs.existsSync(path.join(workingDir, 'dist', 'stats-node.json'))) {
      throw new Error(`Building ${componentLibrary} did not emit a node stats file`)
    }

    const browserStatsFilename = `stats-browser.${commitHash}.json`
    fs.renameSync(path.join(workingDir, 'dist', 'stats-browser.json'), path.join(workingDir, 'dist', browserStatsFilename))

    const nodeStatsFilename = `stats-node.${commitHash}.json`
    fs.renameSync(path.join(workingDir, 'dist', 'stats-node.json'), path.join(workingDir, 'dist', nodeStatsFilename))

    if (componentLibraryPackage.scripts.test) {
      core.log(logNamespace, `running tests`)
      await doPromiseExec('yarn test', { cwd: workingDir })
      core.log(logNamespace, `finished tests`)
    }

    return fs.readdir(workingDistDir).then(buildAssetBasenames => {
      return buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))
    }).then(buildAssets => {
      const buildManifestEntry = {
        commitHash,
        commitMessage,
        author,
        browserStats: browserStatsFilename,
        nodeStats: nodeStatsFilename,
        createdAt: new Date().toString()
      }

      return core.registerComponentLibrary(componentLibrary, buildAssets, buildManifestEntry)
    }).then(() => {
      core.log(logNamespace, `built ${commitHash}`)
    })
  }

  async ensureRepoIsClonedAndUpdated (componentLibrary: string, repoSource: string, branch: string): Promise<string> {
    const doPromiseExec = wrapPromiseExecLogNamespace(`theia:builder ${componentLibrary}`)

    const projectRootDir = path.resolve(__dirname, '..')
    const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

    const exists = await fs.pathExists(workingDir)
    if (!exists) {
      await doPromiseExec(`git clone ${repoSource} ${workingDir}`)
    }

    if (process.env.THEIA_ONLY_CHECKOUT_COMMIT) {
      // only for perf test
      await doPromiseExec(`git checkout --quiet ${branch}`, { cwd: workingDir })
    } else {
      await doPromiseExec(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })
    }

    return workingDir
  }

  hasBuilt (core: Core, componentLibrary: string, commitHash: string): Promise<boolean> {
    return core.hasBuildManifest(componentLibrary).then(result => {
      if (!result) return false
      return core.getBuildManifest(componentLibrary).then(buildManifest => {
        return buildManifest.some(entry => entry.commitHash === commitHash)
      })
    })
  }
}

export default DefaultBuilder
