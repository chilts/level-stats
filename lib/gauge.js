// npm
const yid = require('yid')
const inherits = require('inherits')

// local
const Base = require('./base.js')
const levelHelpers = require('./level-helpers.js')

// Gauge
function Gauge(db, prefix, opts) {
  if (!(this instanceof Gauge)) {
    return new Gauge(db, prefix, opts)
  }

  // Sets up:
  // * this._prefix
  // * this.opts
  // * this.db (a `sub()`)
  // * this.valDb
  // * this.aggDb
  Base.call(this, db, prefix, opts)
}

inherits(Gauge, Base)

Gauge.prototype.set = function set(val, callback) {
  const id = yid()
  this.valDb.put(id, Number(val), callback)
}

Gauge.prototype.val = function val(callback) {
  levelHelpers.getLastItemInDb(this.valDb, (err, item) => {
    if (err) {
      callback(err)
      return
    }
    console.log('item:', item)
    callback(null, item.value)
  })
}

Gauge.prototype.aggregate = function aggregate(periodLengthMs, callback) {
  let count = 0
  let min = Infinity
  let max = -Infinity
  let total = 0

  function aggFn(data) {
    console.log('data:', data)
    count += 1
    min = data.value < min ? data.value : min
    max = data.value > max ? data.value : max
    total += data.value
  }

  function finalFn() {
    const agg = {
      count,
    }
    if (count > 0) {
      // only include these if we had some readings
      agg.min = min
      agg.max = max
      agg.avg = total / count
    }
    console.log('agg:', agg)
    return agg
  }

  this._aggregate(periodLengthMs, aggFn, finalFn, callback)
}

module.exports = Gauge
