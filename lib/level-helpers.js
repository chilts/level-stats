// local
const timePeriod = require('./time-period.js')

// functions
function getOneItemInDb(db, opts, callback) {
  opts.limit = 1

  let item = null
  db.createReadStream(opts)
    .on('data', data => {
      item = data
    })
    .on('err', callback)
    .on('end', () => {
      callback(null, item)
    })
}

function getFirstItemInDb(db, callback) {
  getOneItemInDb(db, {}, callback)
}

function getLastItemInDb(db, callback) {
  getOneItemInDb(db, { reverse: true}, callback)
}

function getLastAggPeriodTs(periodLengthMs, aggDb, valDb, callback) {
  // firstly, see if we can get the latest aggregate item
  getLastItemInDb(aggDb, (err, item) => {
    if (err) {
      callback(err)
      return
    }

    // if we already have an item, then convert to periodTs
    if (item) {
      callback(null, Number(item.key))
      return
    }

    // no item found in aggregate set, so we need to check the values
    getFirstItemInDb(valDb, (err, item) => {
      if (err) {
        callback(err)
        return
      }
      const periodTs = timePeriod.yidToPeriod(item.key, periodLengthMs) - periodLengthMs
      callback(null, periodTs)
    })
  })
}

module.exports = {
  getOneItemInDb,
  getFirstItemInDb,
  getLastItemInDb,
  getLastAggPeriodTs,
}
