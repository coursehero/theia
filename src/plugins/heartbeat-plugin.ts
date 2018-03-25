import * as express from 'express'

class HeartbeatPlugin implements Theia.Plugin {
  apply (core: Theia.Core) {
    core.hooks.express.tapPromise('HeartbeatPlugin', this.onExpress)
  }

  onExpress = (core: Theia.Core, app: express.Application) => {
    app.get('/heartbeat', (req, res) => {
      res.send('thud thud')
    })

    return Promise.resolve()
  }
}

export default HeartbeatPlugin
