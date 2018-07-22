import * as rimraf from 'rimraf'
import LocalStorage from '../local-storage'
import theia from '../theia'
import {Configuration} from '../theia'

describe('mythos', () => {
  rimraf.sync(__dirname + '/jest-libs')
  const storage = new LocalStorage(__dirname + '/jest-libs')

  const config: Configuration = {
    libs: {
      mythos: {
        source: "https://github.com/theiajs/mythos.git",
        branches: {
          development: "dev",
          production: "master"
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
    const buildManifest = await core.getBuildManifest('mythos')
    expect(buildManifest.length).toBe(1)
    
    const statsBasename = buildManifest[0].stats
    const stats = JSON.parse(await core.storage.load('mythos', statsBasename))
    expect(stats).toMatchObject({
      "assetsByChunkName": {
        "manifest": [
          "manifest.7ebe6ba1d14adc2465d7.js",
          "manifest.7ebe6ba1d14adc2465d7.js.map"
        ]
      }
    })
    
    for (const assetBasename of stats.assetsByChunkName.manifest) {
      const assetSource = await core.storage.load('mythos', assetBasename)
      expect(assetSource).toBeTruthy()
    }
  })

  test('renders', async () => {
    const result = await core.render('mythos', 'Greeting', { name: 'Theia' })
    expect(result).toEqual({
      html: '<div data-reactroot="">Hello <em>Theia</em>!!!</div>',
      assets: {
        javascripts: [ 'manifest.7ebe6ba1d14adc2465d7.js' ],
        stylesheets: []
      }
    })
  })

  test('renders something using ReactDOM', async () => {
    const result = await core.render('mythos', 'MythosApp', { })
    expect(result).toEqual({
      html: '<div data-reactroot="">Mythos App</div>',
      assets: {
        javascripts: [ 'manifest.7ebe6ba1d14adc2465d7.js' ],
        stylesheets: []
      }
    })
  })
})
