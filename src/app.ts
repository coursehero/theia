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
  status?: number;
}

var app: express.Application = express()

app.engine('adoc', AsciidoctorEngine)
app.set('view engine', 'adoc')
app.set('views', path.join(__dirname, '..', 'views'))

app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, '..', 'public')));

theia.hooks.express.call(theia, app)

app.post('/render', (req, res) => {
  res.send(theia.render(req.query.componentLibrary, req.query.component, req.body))
})

app.get('/chunks', function(req, res, next) {
  if (req.path.endsWith('.js') /*|| req.path.endsWith('.js.map')*/) {
    return next()
  }
  
  res.send(404)
})
app.use('/chunks', express.static(path.join(__dirname, '..', 'libs')))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err: ResponseError = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handler
app.use(function(err, req, res, next) {
  err.status = err.status || 500

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
