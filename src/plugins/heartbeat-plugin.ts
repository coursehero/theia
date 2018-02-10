import Theia from '../theia'
import * as express from 'express'

class HeartbeatPlugin implements Theia.Plugin {
  apply (theia: Theia) {
    theia.hooks.express.tap('HeartbeatPlugin', this.onExpress.bind(this))
  }

  onExpress (theia: Theia, app: express.Application) {
    app.get('/heartbeat', (req, res) => {
      res.send('thud thud')
    })
  }
}

export default HeartbeatPlugin
