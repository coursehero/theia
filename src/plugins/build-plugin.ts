import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as fs from 'fs-extra'
import * as path from 'path'
import { execSync } from 'child_process'

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
    const buildManifest = theia.buildManifest
    const projectRootDir = path.resolve(__dirname, '..', '..')

    function build (componentLibrary: string, workingDir: string) {
      console.log(`checking for updates for ${componentLibrary} from ${workingDir} ...`)

      const commitHash = execSync(`git rev-parse HEAD`, { cwd: workingDir }).toString().trim()
      if (!hasBuilt(componentLibrary, commitHash)) {
        console.log(`building commit hash ${commitHash} ...`)
        const now = new Date().toString()

        const statsFilename = `stats.${commitHash}.json`
        execSync(`yarn install --production=false --non-interactive && mkdir -p dist && ./node_modules/.bin/webpack --json > dist/${statsFilename}`, { cwd: workingDir })

        const outputDir = path.resolve(projectRootDir, 'libs', componentLibrary)
        fs.ensureDirSync(outputDir)
        fs.copySync(path.resolve(workingDir, 'dist'), outputDir)

        console.log(`built ${componentLibrary} ${commitHash}`)

        theia.registerComponentLibraryVersion(componentLibrary, {
          commitHash,
          manifest: require(path.resolve(outputDir, statsFilename)).assetsByChunkName.manifest[0],
          createdAt: now
        })
      }
    }

    function buildWithGitCache (componentLibrary: string, projectPath: string, branch: string) {
      const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

      if (fs.existsSync(workingDir)) {
        execSync(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })
      } else {
        execSync(`git clone -b ${branch} ${projectPath} ${workingDir}`)
      }

      build(componentLibrary, workingDir)
    }

    function hasBuilt (componentLibrary: string, commitHash: string) {
      const libVersions = buildManifest.libs[componentLibrary]
      return libVersions && libVersions.some(libVersion => libVersion.commitHash === commitHash)
    }

    const isLocalBuildingEnabled = process.env.THEIA_LOCAL === '1'
    if (isLocalBuildingEnabled) {
      console.log('***********')
      console.log('BUILDING LOCALLY')
      console.log(theia.localConfig.libs)
      console.log('***********')
    }

    const environment: ('development' | 'production') = (process.env.NODE_ENV as 'development' | 'production') || 'development'
    const libs = theia.config.libs
    const localLibs = isLocalBuildingEnabled ? theia.localConfig.libs : {}

    console.log('building component libraries ...')

    for (const componentLibrary in libs) {
      if (localLibs[componentLibrary]) {
        build(componentLibrary, localLibs[componentLibrary])
      } else {
        const componentLibraryConfig = libs[componentLibrary]
        buildWithGitCache(componentLibrary, componentLibraryConfig.source, componentLibraryConfig[environment].branch)
      }
    }

    console.log('finished building component libraries')
  }
}

export default BuildPlugin
