import * as express from 'express'

class UsagePlugin implements Theia.Plugin {
  apply (core: Theia.Core) {
    core.hooks.express.tapPromise('UsagePlugin', this.onExpress)
  }

  onExpress = (core: Theia.Core, app: express.Application) => {
    app.get('/', async (req, res) => {
      const helloWorldResult = await core.render('mythos', 'Greeting', {
        name: 'World'
      })

      res.render('usage', {
        helloWorldResultHtml: helloWorldResult.html,
        helloWorldResultAssets: JSON.stringify(helloWorldResult.assets, null, 2)
      })
    })

    return Promise.resolve()
  }
}

export default UsagePlugin
