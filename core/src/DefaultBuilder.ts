import { exec as __exec } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { log, logError } from './Logger'
import { Builder, BuildLogStage, BuildManifestEntry, ComponentLibraryConfiguration, Core } from './theia'

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

function stageStart (buildLog: BuildLogStage[], name: string) {
  buildLog.push({ name, started: new Date(), ended: null })
}

function stageEnd (buildLog: BuildLogStage[]) {
  buildLog[buildLog.length - 1].ended = new Date()
}

class DefaultBuilder implements Builder {
  async build (core: Core, componentLibrary: string, componentLibraryConfig: ComponentLibraryConfiguration) {
    const logNamespace = `theia:builder ${componentLibrary}`

    const branchOrCommit = componentLibraryConfig.env![core.environment]
    const workingDir = await this.ensureRepoIsClonedAndUpdated(core.config.gitDir, componentLibrary, componentLibraryConfig.source, branchOrCommit)
    const buildAssets: string[] = []
    const buildManifestEntry: BuildManifestEntry = {
      commitHash: '',
      commitMessage: '',
      author: { name: '', email: '' },
      browserStats: '',
      nodeStats: '',
      createdAt: new Date().toString(),
      react: '',
      reactDOMServer: '',
      success: false
    }

    const buildLog: BuildLogStage[] = []
    const doTick = () => void core.hooks.buildTick.promise({ core, componentLibrary, buildLog, buildManifestEntry })
    const onTickTimerHandle = setInterval(doTick, 1000)
    doTick()

    const _finally = () => {
      if (buildLog.length > 0 && !buildLog[buildLog.length - 1].ended) stageEnd(buildLog)
      clearTimeout(onTickTimerHandle)
      doTick()

      if (!buildManifestEntry.commitHash) {
        // no changes
        return Promise.resolve()
      }

      return core.registerComponentLibrary(componentLibrary, buildAssets, buildManifestEntry).then(() => {
        if (buildManifestEntry.success) {
          core.log(logNamespace, `built ${buildManifestEntry.commitHash}`)
        } else {
          core.log(logNamespace, `failed to build ${buildManifestEntry.commitHash}`)
        }
      })
    }
    return this.buildFromDir(core, componentLibrary, workingDir, buildLog, buildAssets, buildManifestEntry).then(() => {
      return _finally()
    }).catch((err) => {
      core.logError(logNamespace, err)
      return _finally()
    })
  }

  async buildFromDir (core: Core, componentLibrary: string, workingDir: string, buildLog: BuildLogStage[], buildAssets: string[], bme: BuildManifestEntry): Promise<void> {
    const logNamespace = `theia:builder ${componentLibrary}`
    const doPromiseExec = wrapPromiseExecLogNamespace(logNamespace)

    core.log(logNamespace, `checking for updates in ${workingDir} ...`)
    const commitHash = await doPromiseExec(`git rev-parse HEAD`, { cwd: workingDir })
    if (commitHash && await this.hasBuilt(core, componentLibrary, commitHash)) {
      core.log(logNamespace, `no updates found`)
      return
    }
    bme.commitHash = commitHash

    stageStart(buildLog, 'yarn install')

    bme.commitMessage = (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%s`, { cwd: workingDir }))
    bme.author = {
      name: (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%aN`, { cwd: workingDir })),
      email: (await doPromiseExec(`git log -1 ${commitHash} --pretty=format:%ae`, { cwd: workingDir }))
    }

    core.log(logNamespace, `installing ${commitHash} ...`)
    await doPromiseExec('yarn install --production=false --non-interactive', { cwd: workingDir })
    stageEnd(buildLog)

    const componentLibraryPackage = require(path.resolve(workingDir, 'package.json'))
    if (componentLibraryPackage.scripts.test) {
      core.log(logNamespace, `running tests`)
      stageStart(buildLog, 'yarn test')
      await doPromiseExec('yarn test', { cwd: workingDir })
      stageEnd(buildLog)
      core.log(logNamespace, `finished tests`)
    }

    stageStart(buildLog, 'build')
    core.log(logNamespace, `building ${commitHash} ...`)
    await doPromiseExec('rm -rf dist && mkdir dist', { cwd: workingDir })
    const buildCommand = componentLibraryPackage.scripts.build ? // if build script exists, use it
                          'yarn build' :
                          './node_modules/.bin/webpack --json > dist/stats-browser.json && ./node_modules/.bin/webpack --json --output-library-target commonjs2 > dist/stats-node.json'
    await doPromiseExec(buildCommand, { cwd: workingDir }).catch(stderr => {
      const errors: string[] = []

      // webpack does not send errors to stdout when using "--json"
      // instead, it puts it in the json output
      const statsPaths = [path.join(workingDir, 'dist', 'stats-node.json'), path.join(workingDir, 'dist', 'stats-browser.json')]
      statsPaths.forEach(statsPath => {
        if (fs.pathExistsSync(statsPath)) {
          const stats = require(statsPath)
          if (stats.errors && stats.errors.length) {
            errors.push(...stats.errors)
          }
        }
      })

      if (stderr) errors.push(stderr)
      throw new Error(errors.join('\n====\n') || 'Unknown error while building')
    })

    if (!fs.existsSync(path.join(workingDir, 'dist', 'stats-browser.json'))) {
      throw new Error(`Building ${componentLibrary} did not emit a browser stats file`)
    }

    if (!fs.existsSync(path.join(workingDir, 'dist', 'stats-node.json'))) {
      throw new Error(`Building ${componentLibrary} did not emit a node stats file`)
    }

    stageEnd(buildLog)
    stageStart(buildLog, 'copy assets')

    bme.browserStats = `stats-browser.${commitHash}.json`
    fs.renameSync(path.join(workingDir, 'dist', 'stats-browser.json'), path.join(workingDir, 'dist', bme.browserStats))

    bme.nodeStats = `stats-node.${commitHash}.json`
    fs.renameSync(path.join(workingDir, 'dist', 'stats-node.json'), path.join(workingDir, 'dist', bme.nodeStats))

    // extract react stuff
    const reactBuildCommand = './node_modules/.bin/webpack React=react ReactDOMServer=react-dom/server --output-library-target commonjs2 --output-path=dist'
    await doPromiseExec(reactBuildCommand, { cwd: workingDir }).catch(err => {
      // webpack does not send errors to stdout when using "--json"
      // instead, it puts it in the json output
      const statsPaths = [path.join(workingDir, 'dist', 'stats-react.json')]
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

    const buildAssetBasenames = await fs.readdir(path.resolve(workingDir, 'dist'))
    buildAssets.push(...buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename)))

    bme.react = buildAssetBasenames.find(f => /^React\..*\.js$/.test(f)) || ''
    bme.reactDOMServer = buildAssetBasenames.find(f => /^ReactDOMServer\..*\.js$/.test(f)) || ''

    if (!bme.react || !bme.reactDOMServer) {
      throw new Error('could not discover react files')
    }

    bme.success = true
  }

  async ensureRepoIsClonedAndUpdated (gitDir: string, componentLibrary: string, repoSource: string, branchOrCommit: string): Promise<string> {
    const doPromiseExec = wrapPromiseExecLogNamespace(`theia:builder ${componentLibrary}`)
    const workingDir = path.join(gitDir, componentLibrary)

    const exists = await fs.pathExists(workingDir)
    if (!exists) {
      await doPromiseExec(`git clone ${repoSource} ${workingDir}`)
    }

    const isBranch = await doPromiseExec(`git ls-remote --heads ${repoSource} ${branchOrCommit} | wc -l`, { cwd: workingDir }) !== '0'
    if (isBranch) {
      await doPromiseExec(`git checkout --quiet ${branchOrCommit} && git pull`, { cwd: workingDir })
    } else {
      await doPromiseExec(`git checkout --quiet ${branchOrCommit}`, { cwd: workingDir })
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
