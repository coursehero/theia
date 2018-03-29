import 'newrelic'
import theia from './theia'

theia().start().then(() => {
  console.log('starting Theia server')
}).catch(e => {
  console.error(`error while starting Theia server: ${e}`)
})
