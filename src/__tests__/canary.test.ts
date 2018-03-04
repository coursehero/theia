import Core from '../core'
import LocalStorage from '../local-storage'

test('adds 1 + 2 to equal 3', () => {
  expect(1 + 2).toBe(3)
})

test('builds mythos', () => {
  const config: Theia.Configuration = {
    libs: {
      "@coursehero-components/mythos": {
          "source": "git@git.coursehero.com:coursehero/components/mythos.git",
          "branches": {
              "development": "dev",
              "production": "master"
          }
      }
    }
  }

  const storage = new LocalStorage(__dirname + '/jest-libs')

  const theia = new Core({
    config,
    storage
  })

  return theia.buildAll().then(() => {
    console.log('done with test build')
  })
}, 1000 * 60)
