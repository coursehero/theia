import * as http from 'http'
import createExpressApp from '../create-express-app'

class ExpressPlugin implements Theia.Plugin {
  port: number

  constructor (port: number) {
    this.port = port
  }

  apply (core: Theia.Core) {
    core.hooks.start.tap('ExpressPlugin', this.onStart.bind(this))
  }

  onStart (core: Theia.Core) {
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
          console.error(`Port ${port} requires elevated privileges`)
          process.exit(1)
          break
        case 'EADDRINUSE':
          console.error(`Port ${port} is already in use`)
          process.exit(1)
          break
        default:
          throw error
      }
    }

    function onListening () {
      const addr = server.address()
      console.log('Listening on port ' + addr.port)
    }
  }
}

export default ExpressPlugin
