# Level Stats #

A stats datastore built on top of LevelUp. Contains (so far):

* gauges
* counters

## Synopsis ##

Creating a gauge or counter is pretty simple. You just need an open Level
instance, plus the string you want to name it.

```js
const level = require('level')
const { Gauge, Counter } = require('level-stats')

// open DB
const db = level(path.join(__dirname, ".data", "test"))
```

Then, to create a Gauge which measures the temperature in your kitchen:

```js
const kitchenTemp = Gauge(db, 'home.kitchen')

// set the current temperature whenever you read it
kitchenTemp.set(19.7)

// at some stage later
kitchenTemp.set(21.3)

// and later still
kitchenTemp.set(20.9)
```

Or to create a Counter which counts the number of cars going past your house:

```js
const cars = Counter(db, 'chilts.tea')

// add one car
cars.add(1)

// you may send a larger number
cars.add(3)
```

## Types ##

### Gauges ###

Gauges are numbers that can (somtimes randomly) go up or down, such as
temperature, amount of bandwidth used per hour, or your current speed.

#### Synopsis ####

Here's a small program to get you started:

```
// create a gauge - pass db and name (used for the sublevel prefix)
const kitchen = Gauge(db, 'home.kitchen')

// set a new value
kitchen.set(19.6)
kitchen.set(21.4)
// gives the aggregate { count: 2, min: 19.6, max: 21.4, val: 20.5 }

// aggregate hourly and daily
kitchen.aggregate(ms('1 hour'))
kitchen.aggregate(ms('1 day'))

// stream all the hourly aggregates
kitchen.createAggregateStream(ms('1 hour'))
  .on('data', console.log)
  .on('err', console.warn)
```

#### Gauge Constructor ####

Just pass the sublevel DB where to store the gauge measurements and a name
(which is also used as the new sublevel prefix):

```js
// these are functionally equivalent
const kitchenTemp = Gauge(db, 'kitchen')
const kitchenTemp = new Gauge(db, 'kitchen')
```

#### `gauge.set(val, callback)` ####

Adds a new measurement to this gauge. `val` must be a number. The `callback`
just tells you when it's been added to LevelDB (or gives you an error).

#### `gauge.val(callback)` ####

Gets you the latest value of this gauge. It doesn't do any manipulation or
aggregation, it just returns the last value it saw.

#### `gauge.aggregate(periodLengthMs, callback)` ####

Will aggregate one time period from the set of measurements/values and stores
them in the DB for later retrieval. This function will:

* do nothing if no values (measurements) are available
* aggregates the first time period if no other aggregates have been performed
* aggregates the next complete time period if at least one other aggregate has
  been performed
* do nothing if the next period is also the current (incomplete) period

You are allowed to aggregate over multiple `periodLengthMs` as you see fit,
such that you may want to aggregate hourly as well as daily. Or every 5 mins,
10 mins, and every 15 mins.

The `periodLengthMs` is the amount of time to aggregate over, in
milliseconds. E.g. using [ms](https://www.npmjs.com/package/ms) or doing it
yourself:

* `ms('5 mins')` or `5 * 60 * 1000`
* `ms('1 hour')` or `60 * 60 * 1000`
* `ms('6 hours')` or `6 * 60 * 60 * 1000`
* `ms('1 day')` or `24 * 60 * 60 * 1000`
* Note: there is nothing stopping you aggregating over 314159ms, but that's
  your choice!

You should call this function regularly, and we'd suggest every 1/2 or 1/3 of
the `periodLengthMs`, so that you keep on top of it. We let you do this when
you want, rather than us, so you can call it whenever is convenient or makes
more sense for your use-case.

e.g.

```js
const periodMs = ms('1 hour')
setInterval(() => {
  kitchenTemp.aggregate(periodMs, err => {
    // check err!
    console.log('Done')
  })
}, periodMs/2)
```

#### `gauge.createAggregateStream(periodLengthMs, opts)` ####

Returns a LevelDB stream (an EventEmitter) but we'll add extra fields onto the
`data` event if requested in `opts`. Emits all items in the aggregate defined
by `periodLengthMs`.

If you ask for a `periodLengthMs` that hasn't been aggregated (using
`.aggregate()`, you won't get any data since none is available yet.

Just like the LevelDB stream, you can pass these opts:

* lt, lte, gt, gte
* reverse
* limit

The returned items look like:

```
item: {
  key: '1587441600000',
  value: {
    count: 6,
    min: 12.36,
    max: 21.33,
    avg: 17.131666666666668
  }
}
```

You can also pass these boolean options which will simplify or embellish the
returned item:

* `keys` (default: `true`)
* `date` (default: `false`)
* `epoch` (default: `false`)
* `iso` (default: `false`)

Passing `values: false` (as is allowed in LevelDB) doesn't make sense here, so
we delete it and therefore ignore it.

This embellishes each item with the corresponding field, such as:

```
item: {
  key: '1587441600000',
  value: {
    count: 6,
    min: 12.36,
    max: 21.33,
    avg: 17.131666666666668
  },
  date: 2020-04-21T04:00:00.000Z,
  epoch: 1587441600000,
  iso: '2020-04-21T04:00:00.000Z'
}
```

These options just mean you don't need to do any grunt work to turn them into
dates, epochs, or ISO dates.

### Counters ###

```js
// create a counter - pass db and name (used for the sublevel prefix)
const cars = Counter(db, 'cars')

// add some onto the count
cars.add(1)
cars.add(3)
// gives the aggregate { count: 2, total: 4}
```

Counters are almost the same a gauges except counters:

* don't aggregate min/max/avg
* only provide:
  * `count` - the number of measurements added
  * `total` - the sum of all measurements

Also, counters use `.add()` instead of `.set()`.

Other things such as `.aggregate()` and `.createAggregateStream()` are the
same.

## Future ##

These types will be added in the future.

* timers (?)
* sets (?)

Also, sets can be used as small sets (exact) or large sets (approximate). Large
sets are implemented using HyperLogLogs

## ChangeLog ##

* v1.2.1
  * (FIX) Minor fix to ReadMe formatting
* v1.2.0
  * (NEW) Counter
* v1.1.0
  * Some refactoring
* v1.0.0
  * (NEW) Gauge

## Inspiration ##

* Flickr's [Counting & Timing](https://code.flickr.net/2008/10/27/counting-timing/)
  * [The Original StatsD](https://github.com/iamcal/Flickr-StatsD)
* Etsy's [Measure Anything, Measure Everything](https://codeascraft.com/2011/02/15/measure-anything-measure-everything/)
  * [statsd](https://github.com/statsd/statsd)

And other projects:

* [rollup by iamcal](https://github.com/iamcal/wrollup)
* [statsite by armon](https://github.com/statsite/statsite)
* [metrics by codahale](https://github.com/codahale/metrics)
* [metricsd by mojodna](https://github.com/mojodna/metricsd)
* [statsite by kiip](https://github.com/kiip/statsite)

## Author ##

```
$ npx chilts

   ╒════════════════════════════════════════════════════╕
   │                                                    │
   │   Andrew Chilton (Personal)                        │
   │   -------------------------                        │
   │                                                    │
   │          Email : andychilton@gmail.com             │
   │            Web : https://chilts.org                │
   │        Twitter : https://twitter.com/andychilton   │
   │         GitHub : https://github.com/chilts         │
   │         GitLab : https://gitlab.org/chilts         │
   │                                                    │
   │   Apps Attic Ltd (My Company)                      │
   │   ---------------------------                      │
   │                                                    │
   │          Email : chilts@appsattic.com              │
   │            Web : https://appsattic.com             │
   │        Twitter : https://twitter.com/AppsAttic     │
   │         GitLab : https://gitlab.com/appsattic      │
   │                                                    │
   │   Node.js / npm                                    │
   │   -------------                                    │
   │                                                    │
   │        Profile : https://www.npmjs.com/~chilts     │
   │           Card : $ npx chilts                      │
   │                                                    │
   ╘════════════════════════════════════════════════════╛
```

## License ##

MIT.

(Ends)
