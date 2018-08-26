import * as rimraf from 'rimraf'
import theia, { Configuration, LocalStorage } from '../theia'

describe('mythos', () => {
  rimraf.sync(__dirname + '/jest-libs')
  const storage = new LocalStorage(__dirname + '/jest-libs')

  const config: Configuration = {
    environment: 'test',
    libs: {
      canary: {
        source: 'https://github.com/theiajs/mythos.git',
        env: {
          test: '737253db'
        }
      }
    },
    storage,
    loadFromDisk: false
  }

  const core = theia(config)

  beforeAll(() => core.buildAll(), 1000 * 60)
  afterAll(() => rimraf.sync(__dirname + '/jest-libs'))

  test('saves build manifest and assets', async () => {
    const buildManifest = await core.getBuildManifest('canary')
    expect(buildManifest.length).toBe(1)

    const browserStatsBasename = buildManifest[0].browserStats
    const browserStats = JSON.parse(await core.storage.load('canary', browserStatsBasename))
    expect(browserStats).toMatchObject({
      'assetsByChunkName': {
        'MythosApp': [
          'MythosApp.e0fecb7372d5af75e495.js',
          'MythosApp.e0fecb7372d5af75e495.js.map'
        ],
        'Greeting': [
          'Greeting.273e3e5ff522ff4c096d.js',
          'Greeting.273e3e5ff522ff4c096d.js.map'
        ]
      }
    })

    for (const assetBasename of browserStats.assetsByChunkName.MythosApp) {
      const assetSource = await core.storage.load('canary', assetBasename)
      expect(assetSource).toBeTruthy()
    }
    for (const assetBasename of browserStats.assetsByChunkName.Greeting) {
      const assetSource = await core.storage.load('canary', assetBasename)
      expect(assetSource).toBeTruthy()
    }

    const nodeStatsBasename = buildManifest[0].nodeStats
    expect(JSON.parse(await core.storage.load('canary', nodeStatsBasename))).toMatchObject({
      'assetsByChunkName': {
        'MythosApp': [
          'MythosApp.efc49a5270059a414b0c.js',
          'MythosApp.efc49a5270059a414b0c.js.map'
        ],
        'Greeting': [
          'Greeting.e804c8e6bbc5548e5e94.js',
          'Greeting.e804c8e6bbc5548e5e94.js.map'
        ]
      }
    })
  })

  test('renders', async () => {
    const result = await core.render(null as any, 'canary', 'Greeting', { name: 'Theia' })
    expect(result).toEqual({
      html: '<div data-reactroot="">Hello <em>Theia</em>!!!</div>',
      assets: {
        javascripts: [ 'Greeting.273e3e5ff522ff4c096d.js' ],
        stylesheets: []
      }
    })
  })

  test('renders something using ReactDOM', async () => {
    const result = await core.render(null as any, 'canary', 'MythosApp', { })
    expect(result).toEqual({
      html: '<div data-reactroot="">Mythos App</div>',
      assets: {
        javascripts: [ 'MythosApp.e0fecb7372d5af75e495.js' ],
        stylesheets: []
      }
    })
  })
})
