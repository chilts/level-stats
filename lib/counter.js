// npm
const yid = require('yid')
const inherits = require('inherits')

// local
const Base = require('./base.js')

// Counter
function Counter(db, prefix, opts) {
  if (!(this instanceof Counter)) {
    return new Counter(db, prefix, opts)
  }

  // Sets up:
  // * this._prefix
  // * this.opts
  // * this.db (a `sub()`)
  // * this.valDb
  // * this.aggDb
  Base.call(this, db, prefix, opts)
}

inherits(Counter, Base)

Counter.prototype.add = function add(val, callback) {
  const id = yid()
  this.valDb.put(id, Number(val), callback)
}

Counter.prototype.aggregate = function aggregate(periodLengthMs, callback) {
  const agg = {
    count: 0,
    total: 0,
  }

  function aggFn(data) {
    agg.count += 1
    agg.total += data.value
  }

  function finalFn() {
    return {
      count: agg.count,
      total: agg.total,
    }
  }

  this._aggregate(periodLengthMs, aggFn, finalFn, callback)
}

module.exports = Counter
