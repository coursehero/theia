import * as express from 'express'
import * as HttpStatus from 'http-status-codes'
import * as path from 'path'
import * as favicon from 'serve-favicon'
import * as logger from 'morgan'
import * as cookieParser from 'cookie-parser'
import * as bodyParser from 'body-parser'
import AsciidoctorEngine from './asciidoctor-engine'
import theia from './configure-theia'

theia.start()

interface ResponseError extends Error {
  status?: number
}

const app: express.Application = express()

app.engine('adoc', AsciidoctorEngine)
app.set('view engine', 'adoc')
app.set('views', path.join(__dirname, '..', 'views'))

app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, '..', 'public')))

theia.hooks.express.call(theia, app)

app.post('/render', (req: express.Request, res: express.Response) => {
  res.send(theia.render(req.query.componentLibrary, req.query.component, req.body))
})

app.get('/chunks', function (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (/\.(js|css|map)$/.test(req.path)) {
    return next()
  }

  res.send(HttpStatus.NOT_FOUND)
})
app.use('/chunks', express.static(path.join(__dirname, '..', 'libs')))

// catch 404 and forward to error handler
app.use(function (req: express.Request, res: express.Response, next: express.NextFunction) {
  let err: ResponseError = new Error('Not Found')
  err.status = HttpStatus.NOT_FOUND
  next(err)
})

// error handler
app.use(function (err: ResponseError, req: express.Request, res: express.Response, next: express.NextFunction) {
  err.status = err.status || HttpStatus.INTERNAL_SERVER_ERROR

  if (err.status >= 400 && err.status < 500) {
    console.trace(err.stack)
  } else {
    console.error(err.stack)
  }

  res.status(err.status)
  res.render('error', {
    message: err.message,
    stacktrace: err.stack
  })
})

export default app
