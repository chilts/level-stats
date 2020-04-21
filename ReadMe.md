# Level Stats #

A stats datastore built on top of LevelUp. Contains (so far):

* gauges
* counters

## Gauges ##

Gauges are numbers that can (somtimes randomly) go up or down, such as
temperature, amount of bandwidth used per hour, or your current speed.

### Synopsis ###

Here's a small program to get you started:

```
const level = require('level')
const sub = require("subleveldown")
const { Gauge } = require('level-stats')

// open DB - use subleveldown on top level DB
const db = level(path.join(__dirname, ".data", "test"))
const subDb = sub(db)

// create a gauge - pass name (used as sublevel prefix)
const kitchen = Gauge(subDb, 'home.kitchen')

// set a new value
kitchen.set(Math.random() * 20)
```

### Gauge Constructor ###

Just pass the sublevel DB where to store the gauge measurements and a name
(which is also used as the new sublevel prefix):

```js
// these are functionally equivalent
const kitchenTemp = Gauge(subDb, 'kitchen')
const kitchenTemp = new Gauge(subDb, 'kitchen')
```

### `gauge.set(val, callback)` ###

Adds a new measurement to this gauge. `val` must be a number. The `callback`
just tells you when it's been added to LevelDB (or gives you an error).

### `gauge.val(callback)` ###

Gets you the latest value of this gauge. It doesn't do any manipulation or
aggregation, it just returns the last value it saw.

### `gauge.aggregate(periodLengthMs, callback)` ###

The `periodLengthMs` is the amount of time to aggregate over, in
milliseconds. E.g. using [ms](https://www.npmjs.com/package/ms) or doing it
yourself:

* `ms('5 mins')` or `5 * 60 * 1000`
* `ms('1 hour')` or `60 * 60 * 1000`
* `ms('6 hours')` or `6 * 60 * 60 * 1000`
* `ms('1 day')` or `24 * 60 * 60 * 1000`

Will aggregate one time period from the set of measurements/values and stores
them in the DB for later retrieval. This function will:

* do nothing if no values (measurements) are available
* aggregates the first time period if no other aggregates have been performed
* aggregates the next complete time period if at least one other aggregate has
  been performed
* do nothing if the next period is also the current (incomplete) period

You should call this function regularly, and we'd suggest every 1/2 or 1/3 of
the `periodLengthMs`, so that you keep on top of it. We let you do this when
you want, rather than us, so you can call it whenever is convenient or makes
more sense for your use-case.

### `gauge.createAggregateStream(periodLengthMs, opts, callback)` ###

Returns a LevelDB stream but can add extra fields onto the `data` event if
requested. Emits all items in the aggregate defined by `periodLengthMs`.

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

## Future ##

These types will be added in the future.

* timers (?)
* sets (?)

Also, sets can be used as small sets (exact) or large sets (approximate). Large
sets are implemented using HyperLogLogs

## Aggregation ##

This `level-stats` package does no aggregation but instead stores everything
we've been given. By doing it this way, we can use this package directly and
get a complete picture.

One drawback of course is the amount of space used if our data is getting
bigger. We can therefore put `level-stats-aggregator` in front of `level-stats`
and determine how often to write to the datastore via that package.

## Inspiration ##

* [Flickr's statsd](https://code.flickr.net/2008/10/27/counting-timing/)
  * [The Original StatsD](https://github.com/iamcal/Flickr-StatsD)
* [statsd](https://github.com/statsd/statsd)
* [statsite](https://github.com/statsite/statsite)

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
