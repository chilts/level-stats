// npm
const sub = require("subleveldown")

// local
const Gauge = require('./lib/gauge.js')
const Counter = require('./lib/counter.js')

// export
module.exports = {
  Gauge,
  Counter,
}
