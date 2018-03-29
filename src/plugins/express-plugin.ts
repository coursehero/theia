import * as http from 'http'
import createExpressApp from '../create-express-app'

type OnStartArgs = {
  core: Theia.Core
}

class ExpressPlugin implements Theia.Plugin {
  constructor (public port: number) {}

  apply (core: Theia.Core) {
    core.hooks.start.tapPromise('ExpressPlugin', this.onStart)
  }

  onStart = ({ core }: OnStartArgs) => {
    const app = createExpressApp(core)
    const port = this.port
    app.set('port', port)

    const server = http.createServer(app)
    server.listen(port)
    server.on('error', onError)
    server.on('listening', onListening)

    function onError (error: NodeJS.ErrnoException) {
      if (error.syscall !== 'listen') {
        throw error
      }

      // handle specific listen errors with friendly messages
      switch (error.code) {
        case 'EACCES':
          core.logError('theia:ExpressPlugin', `Port ${port} requires elevated privileges`)
          process.exit(1)
          break
        case 'EADDRINUSE':
          core.logError('theia:ExpressPlugin', `Port ${port} is already in use`)
          process.exit(1)
          break
        default:
          throw error
      }
    }

    function onListening () {
      const addr = server.address()
      core.log('theia:ExpressPlugin', 'Listening on port ' + addr.port)
    }

    return Promise.resolve()
  }
}

export default ExpressPlugin
