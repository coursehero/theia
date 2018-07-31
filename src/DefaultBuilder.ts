import { exec as __exec } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { log, logError } from './Logger'
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
    const branchOrCommit = componentLibraryConfig.env![core.environment]
    const workingDir = await this.ensureRepoIsClonedAndUpdated(componentLibrary, componentLibraryConfig.source, branchOrCommit)

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

    core.log(logNamespace, `installing ${commitHash} ...`)
    await doPromiseExec('yarn install --production=false --non-interactive', { cwd: workingDir })

    const componentLibraryPackage = require(path.resolve(workingDir, 'package.json'))
    if (componentLibraryPackage.scripts.test) {
      core.log(logNamespace, `running tests`)
      await doPromiseExec('yarn test', { cwd: workingDir })
      core.log(logNamespace, `finished tests`)
    }

    core.log(logNamespace, `building ${commitHash} ...`)
    await doPromiseExec('rm -rf dist && mkdir dist', { cwd: workingDir })
    const buildCommand = componentLibraryPackage.scripts.build ? // if build script exists, use it
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
    const buildAssets = buildAssetBasenames.map(basename => path.join(workingDir, 'dist', basename))

    const reactFile = buildAssetBasenames.find(f => /^React\..*\.js$/.test(f))
    const reactDOMServerFile = buildAssetBasenames.find(f => /^ReactDOMServer\..*\.js$/.test(f))

    if (!reactFile || !reactDOMServerFile) {
      throw new Error('could not discover react files')
    }

    const buildManifestEntry = {
      commitHash,
      commitMessage,
      author,
      browserStats: browserStatsFilename,
      nodeStats: nodeStatsFilename,
      createdAt: new Date().toString(),
      react: reactFile,
      reactDOMServer: reactDOMServerFile
    }

    core.log(logNamespace, `manifest entry: ${JSON.stringify(buildManifestEntry)}`)
    return core.registerComponentLibrary(componentLibrary, buildAssets, buildManifestEntry).then(() => {
      core.log(logNamespace, `built ${commitHash}`)
    })
  }

  async ensureRepoIsClonedAndUpdated (componentLibrary: string, repoSource: string, branchOrCommit: string): Promise<string> {
    const doPromiseExec = wrapPromiseExecLogNamespace(`theia:builder ${componentLibrary}`)
    const projectRootDir = path.resolve(__dirname, '..')
    const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)
    
    const exists = await fs.pathExists(workingDir)
    if (!exists) {
      await doPromiseExec(`git clone ${repoSource} ${workingDir}`)
    }

    const isBranch = doPromiseExec(`git ls-remote --heads ${repoSource} ${branchOrCommit}`, { cwd: workingDir })
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
