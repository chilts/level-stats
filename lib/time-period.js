// npm
const yid = require('yid')

function epochToPeriod(epochMs, periodLengthMs) {
  return Math.floor(epochMs / periodLengthMs) * periodLengthMs
}

function currentPeriod(periodLengthMs) {
  const epochMs = Date.now()
  return epochToPeriod(epochMs, periodLengthMs)
}

function yidToPeriod(id, periodLengthMs) {
  const epochMs = yid.asEpoch(id)

  // divide, floor, then multiple again
  return epochToPeriod(epochMs, periodLengthMs)
}

module.exports = {
  epochToPeriod,
  currentPeriod,
  yidToPeriod,
}
