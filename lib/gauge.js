// npm
const sub = require("subleveldown")
const yid = require('yid')

// local
const timePeriod = require('./time-period.js')

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

Gauge.prototype.set = function set(val, cb) {
  const id = yid()
  this.valDb.put(id, Number(val), cb)
}

Gauge.prototype.val = function val(cb) {
  let val = 0

  // get the latest value
  this.valDb.createReadStream()
    .on('data', data => {
      console.log('data:', data)
      val = data.value
    })
    .on('error', cb)
    .on('end', () => {
      cb(null, val)
    })
  ;
}

Gauge.prototype._getLastAggPeriodTs = function _getLastAggPeriodTs(periodLengthMs, db, cb) {
  const self = this

  let periodTs = 0

  db.createReadStream({ reverse: true, limit: 1 })
    .on('data', data => {
      periodTs = Number(data.key)
      console.log('_getLastAggPeriodTs() - periodTs:', periodTs)
    })
    .on('err', cb)
    .on('close', () => {
      console.log('agg stream close')
    })
    .on('end', () => {
      console.log('agg stream end')
      // check to see we have a period
      if (!periodTs) {
        console.log('No aggregate found yet')
        self.valDb.createReadStream({ limit: 1 })
          .on('data', data => {
            periodTs = timePeriod.yidToPeriod(data.key, periodLengthMs) - periodLengthMs
          })
          .on('end', () => {
            console.log('val stream end')
            // this periodTs still might be 0
            cb(null, periodTs)
          })
          .on('close', () => {
            console.log('val stream closed')
          })
          .on('err', cb)

        return
      }

      // got a periodTs
      cb(null, periodTs)
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
  const thisDb = sub(self.aggDb, String(periodLengthMs), { valueEncoding: 'json' })

  // set up all the aggregate variables
  let count = 0
  let min = Infinity
  let max = -Infinity
  let total = 0

  // figure out which timestamp was done last
  self._getLastAggPeriodTs(periodLengthMs, thisDb, (err, lastPeriodTs) => {
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
        thisDb.put(String(periodTs), stats, cb)
      })
      .on('close', () => {
        console.log('close')
      })

  })

}

Gauge.prototype.createAggregateStream = function createAggregateStream(periodLengthMs, opts, cb) {
  const self = this

  if (!('epoch' in opts)) {
    opts.epoch = true
  }
  opts.date = Boolean(opts.date) || false
  opts.iso = Boolean(opts.iso) || false

  // ToDo: put this into an internal function so other functions can also use it!
  const thisDb = sub(self.aggDb, String(periodLengthMs), { valueEncoding: 'json' })

  const stream = thisDb.createReadStream(opts)
    .on('data', data => {
      const item = Object.assign({}, data)
      if (opts.date) {
        item.date = new Date(Number(item.key))
      }
      if (opts.epoch) {
        item.epoch = Number(item.key)
      }
      if (opts.iso) {
        item.iso = (new Date(Number(item.key))).toISOString()
      }
      stream.emit('item', item)
    })

  return stream
}

module.exports = Gauge
