import Theia from '../core'
import * as express from 'express'

class UsagePlugin implements Theia.Plugin {
  apply (theia: Theia) {
    theia.hooks.express.tap('UsagePlugin', this.onExpress.bind(this))
  }

  onExpress (theia: Theia, app: express.Application) {
    app.get('/', async (req, res) => {
      const helloWorldResult = await theia.render('mythos', 'Greeting', {
        name: 'World'
      })

      res.render('usage', {
        helloWorldResultHtml: helloWorldResult.html,
        helloWorldResultAssets: JSON.stringify(helloWorldResult.assets, null, 2)
      })
    })
  }
}

export default UsagePlugin
