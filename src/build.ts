import 'newrelic'
import theia from './theia'

const theia = require('./configure-theia').default
theia().buildAll().then(() => {
  console.log('finished building component libraries')
}).catch(() => {
  console.error('error while building component libraries')
})
