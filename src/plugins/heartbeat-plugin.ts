import * as express from 'express'

class HeartbeatPlugin implements Theia.Plugin {
  apply (core: Theia.Core) {
    core.hooks.express.tap('HeartbeatPlugin', this.onExpress.bind(this))
  }

  onExpress (core: Theia.Core, app: express.Application) {
    app.get('/heartbeat', (req, res) => {
      res.send('thud thud')
    })
  }
}

export default HeartbeatPlugin
