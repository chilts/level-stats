// npm
const sub = require("subleveldown")
const yid = require('yid')

// local
const timePeriod = require('./time-period.js')
const levelHelpers = require('./level-helpers.js')

// Gauge
function Gauge(db, prefix, opts) {
  if (!(this instanceof Gauge)) {
    return new Gauge(db, prefix, opts)
  }

  // check for optional prefix/opts
  if (typeof prefix === 'object' && !opts) {
    opts = prefix
    prefix = ''
  }
  if (!prefix) {
    prefix = ''
  }
  if (!opts) {
    opts = {}
  }

  this._db = db
  this._prefix = prefix
  this.opts = opts
  this.db = sub(db, prefix, { valueEncoding: 'json' })
  this.valDb = sub(this.db, 'val', { valueEncoding: 'json' })
  this.aggDb = sub(this.db, 'agg')
}

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

// This function always:
//
// * finds the last `agg` timestamp, and then chooses the next one
// * aggregates one time period only (sometimes none)
// * it will choose the oldest time period for which it has a measurement
// * it will not aggregate the current time period since we may still be
//   getting measurements
Gauge.prototype.aggregate = function aggregate(periodLengthMs, cb) {
  const self = this

  console.log('periodLengthMs:', periodLengthMs)

  const presentPeriodTs = timePeriod.currentPeriod(periodLengthMs)
  console.log('presentPeriodTs:', (new Date(presentPeriodTs)).toISOString())

  // ToDo: put this into an internal function so other functions can also use it!
  const aggDb = sub(self.aggDb, String(periodLengthMs), { valueEncoding: 'json' })

  // set up all the aggregate variables
  let count = 0
  let min = Infinity
  let max = -Infinity
  let total = 0

  // figure out which timestamp was done last
  levelHelpers.getLastAggPeriodTs(periodLengthMs, aggDb, self.valDb, (err, lastPeriodTs) => {
    if (err) return cb(err)

    // if this is 0, then we have no data at all!
    if (lastPeriodTs == 0) {
      console.log('Absolutely nothing to do - no data at all!')
      cb()
      return
    }

    // now try the next period
    const periodTs = lastPeriodTs + periodLengthMs
    console.log('periodTs:', (new Date(periodTs)).toISOString())
    console.log('   -> to:', (new Date(periodTs + periodLengthMs)).toISOString())

    // if this is the current time period then finish up
    if ( periodTs === presentPeriodTs ) {
      console.log('Current time period, finishing... (not writing anything)')
      return
    }

    // get the latest value
    const range = {
      gte: String(periodTs),
      lt: String(periodTs + periodLengthMs),
    }
    const stream = this.valDb.createReadStream(range)
      .on('error', cb)
      .on('data', data => {
        // same period, so remember current stats and continue
        count += 1
        min = data.value < min ? data.value : min
        max = data.value > max ? data.value : max
        total += data.value
      })
      .on('end', () => {
        console.log('end')
        console.log('Stream ended, finishing...')

        // always write an aggregate, even for empty ranges
        console.log(`Writing aggregate for period ${periodTs}`)

        const stats = {
          count,
        }
        if (count > 0) {
          // only include these if we had some readings
          stats.min = min
          stats.max = max
          stats.avg = total / count
        }
        console.log('stats:', stats)

        // write this aggregate
        console.log('Putting aggregate ...')
        aggDb.put(String(periodTs), stats, cb)
      })
      .on('close', () => {
        console.log('close')
      })

  })

}

Gauge.prototype.createAggregateStream = function createAggregateStream(periodLengthMs, opts, cb) {
  const self = this

  // this option doesn't make sense, so delete it
  delete opts.values

  // set some `opts` defaults
  opts = Object.assign({}, { keys: true }, opts)
  opts.epoch = Boolean(opts.epoch)
  opts.date = Boolean(opts.date)
  opts.iso = Boolean(opts.iso)

  if (!opts.keys && !opts.epoch && !opts.date && !opts.iso) {
    throw new Error('Gauge.createAggregateStream() - requires at least one of {keys, epoch, date, iso} to be true.')
  }

  // ToDo: put this into an internal function so other functions can also use it!
  const thisDb = sub(self.aggDb, String(periodLengthMs), { valueEncoding: 'json' })

  // make sure we always get the keys from the actual Level stream!
  const levelOpts = Object.assign({}, opts, { keys: true })
  const stream = thisDb.createReadStream(levelOpts)
    .on('data', data => {
      // This is the same 'data' that will be emitted to outside listeners,
      // so we'll just manipulate it here, since we get first dibs!
      if (opts.date) {
        data.date = new Date(Number(data.key))
      }
      if (opts.epoch) {
        data.epoch = Number(data.key)
      }
      if (opts.iso) {
        data.iso = (new Date(Number(data.key))).toISOString()
      }
      if (!opts.keys) {
        delete data.key
      }
    })

  return stream
}

module.exports = Gauge
