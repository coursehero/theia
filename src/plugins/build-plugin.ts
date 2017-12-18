import Theia from '../theia'
import * as fs from 'fs-extra'
import * as path from 'path'
import { execSync } from 'child_process'

export default (theia: Theia) => {
    const buildManifest = theia.buildManifest
    const projectRootDir = path.resolve(__dirname, '..', '..')

    function build(componentLibrary: string, projectPath: string, branch: string) {
        const workingDir = path.resolve(projectRootDir, 'var', componentLibrary)

        if (fs.existsSync(workingDir)) {
            execSync(`git checkout --quiet ${branch} && git pull`, { cwd: workingDir })
        } else {
            execSync(`git clone -b ${branch} ${projectPath} ${workingDir}`)
        }

        const commitHash = execSync(`git rev-parse HEAD`, { cwd: workingDir }).toString().trim()
        if (!hasBuilt(componentLibrary, commitHash)) {
            console.log(`building ${componentLibrary} ${commitHash} ...`)
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

    function hasBuilt(componentLibrary: string, commitHash: string) {
        const libVerions = buildManifest.libs[componentLibrary]
        return libVerions && libVerions.some(libVersion => libVersion.commitHash === commitHash)
    }

    const environment = process.env.NODE_ENV || 'development'
    const branch = theia.config[environment].branch
    const libs = theia.config.libs

    for (const componentLibrary in libs) {
        build(componentLibrary, libs[componentLibrary], branch)
    }
}
