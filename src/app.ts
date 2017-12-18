import * as express from 'express'
import * as HttpStatus from 'http-status-codes'
import * as path from 'path'
import favicon from 'serve-favicon'
import * as logger from 'morgan'
import * as cookieParser from 'cookie-parser'
import * as bodyParser from 'body-parser'
import * as fs from 'fs-extra'
import theia from './configure-theia'

theia.start()

interface ResponseError extends Error {
  status?: number;
}

var app = express()

// view engine setup
app.set('views', path.join(__dirname, '..', 'views'))
app.set('view engine', 'jade')

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(function(req, res, next) {
  if (req.get('CH-Auth') === 'courseherobatman') {
    return next()
  }
  
  res.send(HttpStatus.FORBIDDEN)
})

app.use('/heartbeat', (req, res) => {
  res.send('thud thud')
})

app.post('/render', (req, res) => {
  res.send(theia.render(req.query.componentLibrary, req.query.component, req.body))
})

app.use('/chunks', function(req, res, next) {
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
  res.locals.message = err.message
  res.locals.error = err

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

export = app
