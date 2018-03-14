import * as express from 'express'
import * as HttpStatus from 'http-status-codes'
import * as path from 'path'
import * as favicon from 'serve-favicon'
import * as logger from 'morgan'
import * as cookieParser from 'cookie-parser'
import * as bodyParser from 'body-parser'
import * as cons from 'consolidate'
import theia from './configure-theia'

interface ResponseError extends Error {
  status?: number
}

export default (core: Theia.Core): express.Application => {
  const app: express.Application = express()

  app.engine('mustache', cons.mustache)
  app.set('view engine', 'mustache')
  app.set('views', path.join(__dirname, '..', 'views'))

  app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')))
  app.use(logger('dev'))
  app.use(bodyParser.json({ limit: '50mb' }))
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }))
  app.use(cookieParser())

  app.use(express.static(path.join(__dirname, '..', 'public')))

  theia.hooks.express.call(theia, app)

  app.post('/render', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { componentLibrary, component } = req.query

    if (!theia.config.libs[componentLibrary]) {
      return res.status(HttpStatus.BAD_REQUEST).send({ error: `Invalid component library: ${componentLibrary}` })
    }

    theia.render(componentLibrary, component, req.body)
      .then(result => {
        res.set('Theia-Assets', JSON.stringify(result.assets))
        res.send(result.html)
      }).catch(reason => {
        next(reason)
      })
  })

  app.get('/assets', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (/\.(js|css|map)$/.test(req.path)) {
      return next()
    }

    res.send(HttpStatus.NOT_FOUND)
  })

  app.use('/assets', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const split = req.path.split('/')
    const componentLibrary = split.slice(1, split.length - 1).join('/')
    const asset = split[split.length - 1]

    theia.storage.load(componentLibrary, asset)
      .then(content => {
        res.contentType(asset)
        res.send(content)
      }).catch(reason => {
        next(reason)
      })
  })

  // catch 404 and forward to error handler
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    let err: ResponseError = new Error('Not Found: ' + req.path)
    err.status = HttpStatus.NOT_FOUND
    next(err)
  })

  // error handler
  app.use((err: ResponseError, req: express.Request, res: express.Response, next: express.NextFunction) => {
    err.status = err.status || HttpStatus.INTERNAL_SERVER_ERROR

    theia.hooks.error.call(theia, err)

    if (err.status >= 400 && err.status < 500) {
      console.trace(err.stack)
    } else {
      console.error(err.stack)
    }

    res.status(err.status)
    res.json({
      error: err.message,
      stacktrace: err.stack
    })
  })

  return app
}