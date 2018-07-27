// yarn build && DEBUG='theia*' node ./dist/perf.js
// rough performance test
// TODO: get insights of performance in production environment

import * as autocannon from 'autocannon'
import * as fs from 'fs'
import LocalStorage from './LocalStorage'
import makeCore, * as theia from './theia'

async function run () {
  const storage = new LocalStorage(__dirname + '/../perf-libs')

  // TODO: make a separate CL to use as a benchmark
  const config: theia.Configuration = {
    environment: 'test',
    libs: {
      benchmark: {
        source: 'git@git.coursehero.com:coursehero/components/study-guides.git',
        env: {
          test: '7a4846ec9d8'
        }
      }
    },
    plugins: [
      new theia.ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)
    ],
    storage,
    loadFromDisk: false
  }

  const core = makeCore(config)
  await core.buildAll()
  await core.start()
  const props = fs.readFileSync('./perf.json', 'utf-8')

  // warm up
  await core.render('benchmark', 'CourseApp', JSON.parse(props))

  autocannon({
    url: 'http://localhost:3000/render?componentLibrary=benchmark&component=CourseApp',
    method: 'POST',
    body: props,
    headers: {
      'Content-Type': 'application/json'
    },
    connections: 50,
    duration: 10
  }, console.log)
}

run().then(() => {
  console.log('starting perf')
}).catch(e => {
  console.error(`error while running perf: ${e}`)
})

/*

initial results (on my machine ...)

{ title: undefined,
  url: 'http://localhost:3000/render?componentLibrary=benchmark&component=CourseApp',
  socketPath: undefined,
  requests:
   { average: 288.7,
     mean: 288.7,
     stddev: 33.9,
     min: 187,
     max: 300,
     total: 2887,
     sent: 2937 },
  latency:
   { average: 177.84,
     mean: 177.84,
     stddev: 34.26,
     min: 147,
     max: 515.377994,
     p50: 164,
     p75: 195,
     p90: 202,
     p99: 261,
     p999: 515,
     p9999: 515,
     p99999: 515 },
  throughput:
   { average: 3342336,
     mean: 3342336,
     stddev: 393216,
     min: 2194445,
     max: 3520500,
     total: 33878945 },
  errors: 0,
  timeouts: 0,
  duration: 10,
  start: 2018-07-26T05:12:42.939Z,
  finish: 2018-07-26T05:12:53.383Z,
  connections: 50,
  pipelining: 1,
  non2xx: 0,
  '1xx': 0,
  '2xx': 2887,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0 }

after moving to new v1 format, and updating to Node 10

{ title: undefined,
  url:
   'http://localhost:3000/render?componentLibrary=benchmark&component=CourseApp',
  socketPath: undefined,
  requests:
   { average: 298.7,
     mean: 298.7,
     stddev: 46.27,
     min: 187,
     max: 350,
     total: 2987,
     sent: 3037 },
  latency:
   { average: 178.87,
     mean: 178.87,
     stddev: 34.56,
     min: 147,
     max: 532.486256,
     p50: 175,
     p75: 192,
     p90: 204,
     p99: 279,
     p999: 532,
     p9999: 532,
     p99999: 532 },
  throughput:
   { average: 3499622.4,
     mean: 3499622.4,
     stddev: 549252.68,
     min: 2194819,
     max: 4107950,
     total: 35058419 },
  errors: 0,
  timeouts: 0,
  duration: 11,
  start: 2018-07-27T02:13:41.557Z,
  finish: 2018-07-27T02:13:52.426Z,
  connections: 50,
  pipelining: 1,
  non2xx: 0,
  '1xx': 0,
  '2xx': 2987,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0 }

*/
