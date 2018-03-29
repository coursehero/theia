import * as debug from 'debug'

interface LoggerCache {
  [key: string]: debug.IDebugger
}
const stdOutLoggers: LoggerCache = {}
const stdErrLoggers: LoggerCache = {}

function getStdOutLogger (namespace: string) {
  if (stdOutLoggers[namespace]) return stdOutLoggers[namespace]

  const logger = debug(namespace)
  logger.log = console.log.bind(console)
  return stdOutLoggers[namespace] = logger
}

function getStdErrLogger (namespace: string) {
  if (stdErrLoggers[namespace]) return stdErrLoggers[namespace]
  return stdErrLoggers[namespace] = debug(namespace)
}

function log (namespace: string, message: string) {
  getStdOutLogger(namespace)(message)
}

function logError (namespace: string, message: string) {
  getStdErrLogger(namespace)(message)
}

export { log, logError }
