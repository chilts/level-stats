// npm
const sub = require("subleveldown")
const yid = require('yid')

// local
const timePeriod = require('./time-period.js')
const levelHelpers = require('./level-helpers.js')

function Base(db, prefix, opts) {
  console.log('Base()')

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

  this._prefix = prefix
  this.opts = opts
  this.db = sub(db, prefix, { valueEncoding: 'json' })
  this.valDb = sub(this.db, 'val', { valueEncoding: 'json' })
  this.aggDb = sub(this.db, 'agg')
}

// This function always:
//
// * finds the last `agg` timestamp, and then chooses the next one
// * aggregates one time period only (sometimes none)
// * it will choose the oldest time period for which it has a measurement
// * it will not aggregate the current time period since we may still be
//   getting measurements
Base.prototype._aggregate = function _aggregate(periodLengthMs, aggFn, finalFn, cb) {
  const self = this

  console.log('periodLengthMs:', periodLengthMs)

  const presentPeriodTs = timePeriod.currentPeriod(periodLengthMs)
  console.log('presentPeriodTs:', (new Date(presentPeriodTs)).toISOString())

  // ToDo: put this into an internal function so other functions can also use it!
  const aggDb = sub(self.aggDb, String(periodLengthMs), { valueEncoding: 'json' })

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
        aggFn(data)
      })
      .on('end', () => {
        console.log(`End of period ${periodTs} - computing aggregate ...`)

        // always write an aggregate, even for empty ranges
        const agg = finalFn()

        // write this aggregate
        console.log('Putting aggregate, agg:', agg)
        aggDb.put(String(periodTs), agg, cb)
      })
      .on('close', () => {
        console.log('close')
      })

  })
}

Base.prototype.createAggregateStream = function createAggregateStream(periodLengthMs, opts) {
  const self = this

  // this option doesn't make sense, so delete it
  delete opts.values

  // set some `opts` defaults
  opts = Object.assign({}, { keys: true }, opts)
  opts.epoch = Boolean(opts.epoch)
  opts.date = Boolean(opts.date)
  opts.iso = Boolean(opts.iso)

  if (!opts.keys && !opts.epoch && !opts.date && !opts.iso) {
    throw new Error('Base.createAggregateStream() - requires at least one of {keys, epoch, date, iso} to be true.')
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

module.exports = Base
