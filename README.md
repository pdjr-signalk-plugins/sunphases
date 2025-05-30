# sunphases

Inject sunlight phase data into Signal K.

## Background

Quite a few things I want to automate on my ship require having some
notion of the phases of a day.
For example, there are times when I want to turn on my anchor light
at dusk and turn it off at dawn; or maybe ring eight-bells at midday.
Whatever.

## Description

__sunphases__ implements both a sunphase engine and an
associated notification generator.

The sunphase engine injects sunlight phases (times for sunrise, sunset,
dusk, etc.) into the Signal K state.
Values are calculated at midnight local time and recaclculated each
time the vessel's position changes significantly using Vladimir
Agafonkin's [SunCalc](https://github.com/mourner/suncalc) library.

The notification generator uses a collection of user-defined rules to
test local time against sunphase data and raise notifications based on
the result.

A vanilla installation of __sunphases__ includes a
specimen rule which raises the notification
'notifications.environment.sunphase.daytime' between dawn and dusk and
'notifications.environment.sunphases.nighttime' between dusk and dawn.

## Configuration

The plugin configuration has the following properties.

| Property name | Value type | Value default            | Description |
| :------------ | :--------- | :----------------------- | :---------- |
| positionkey   | String     | 'navigation.position'    | Signal K key which provides vessel position data. |  
| root          | String     | 'environment.sunphases.' | Signal K path under which to store sun phase keys. |
| heartbeat     | Number     | 60                       | Time in seconds between data updates/rule processing. |
| notifications | Array      | (see below)              | Array of *notification* objects. |
| metadata      | Array      | (see below)              | Array of *metadata* objects describing each sunphase key. |

The *root* property value specifies the root under which sunphase keys
will be stored and also the root under which generated notifications
will be placed (i.e. 'notifications.*root*').

The *heartbeat* property defines how frequently the plugin should
refresh its data.
At each *heartbeat* the plugin will:

1. Refresh the keys under *root* if the vessel position has changed by
   more than one degree of latitude or longitude or if Zulu time has
   rolled over into a new day.

2. Process notification rules.

Each *notification* object has the following properties.

| Property name        | Value type | Value default | Description |
| :------------------- | :--------- | :------------ | :---------- |
| rangelo              | Number     | (none)        | String specifying the in-range start time. |
| rangehi              | Number     | (none)        | String specifying the in-range end time. |
| inrangenotification  | Object     | {}            | Object specifying the notification to be raised when the current time of day is between *rangelo* and *rangehi*. |
| outrangenotification | Object     | {}            | Object specifying the notification to be raised when the current time of day is outwith *rangelo* and *rangehi*. |

*rangelo* and *rangehi* can be specified as SunCalc key names
(optionally with some arithmetic tweaking) or as absolute Zulu times.
The required format is:

( *key*[(__+__|__-__)*n*(__h__|__m__|__s__)] | *hh*__:__*mm*__:__*ss* )

where *key* is the name of a SunCalc key (and may be all you need).

*inrangenotification* and *outrangenotification* objects have the
following properties.

| Property name        | Value type | Value default | Description |
| :------------------- | :--------- | :------------ | :---------- |
| key                  | String     | (none)        | The name under which the notification will be placed (the full key name will be 'notifications.*root*.*key*'). |
| state                | String     | 'normal'      | Value to be used for the notification state property. |
| method               | Array      | []            | String array suggesting the methods that might be used to anounce the notification. |

The *metadata* property is an array of data supplying metadata values
for each of the generated sunphase keys.
It is unlikely that you will want or need to change the default values.

The plugin includes the following embedded default configuration.

```
{
  "root": "environment.sunphases.",
  "heartbeat": 60,
  "notifications": [
    {
      "rangelo": "dawn",
      "rangehi": "dusk",
      "inrangenotification": { "key": "daytime" },
      "outrangenotification": { "key": "nighttime" }
    }
  ],
  "metadata": [
    { "key": "dawn", "units": "ISO8601 (UTC)", "description": "Morning nautical twilight ends, morning civil twilight starts" },
    { "key": "dusk", "units": "ISO8601 (UTC)", "description": "Evening nautical twilight starts" },
    { "key": "goldenHour", "units": "ISO8601 (UTC)", "description": "Evening golden hour starts" },
    { "key": "goldenHourEnd", "units": "ISO8601 (UTC)", "description": "Soft light, best time for photography ends" },
    { "key": "nadir", "units": "ISO8601 (UTC)", "description": "Darkest moment of the night, sun is in the lowest position" },
    { "key": "nauticalDawn", "units": "ISO8601 (UTC)", "description": "Morning nautical twilight starts" },
    { "key": "nauticalDusk", "units": "ISO8601 (UTC)", "description": "Evening astronomical twilight starts" },
    { "key": "night", "units": "ISO8601 (UTC)", "description": "Dark enough for astronomical observations" },
    { "key": "nightEnd", "units": "ISO8601 (UTC)", "description": "Morning astronomical twilight starts" },
    { "key": "solarNoon", "units": "ISO8601 (UTC)", "description": "Sun is at its highest elevation" },
    { "key": "sunrise", "units": "ISO8601 (UTC)", "description": "Top edge of the sun appears on the horizon" },
    { "key": "sunriseEnd", "units": "ISO8601 (UTC)", "description": "Bottom edge of the sun touches the horizon" },
    { "key": "sunset", "units": "ISO8601 (UTC)", "description": "Sun disappears below the horizon, evening civil twilight starts" },
    { "key": "sunsetStart", "units": "ISO8601 (UTC)", "description": "Bottom edge of the sun touches the horizon" }
  ]
}
```

## Operation

The plugin starts automatically once installed, but will not operate
until it receives a value on 'navigation.position'.
If your system doesn't have a position source, then you can use a
simulator to supply one.

Once operating the plugin will update key values and process
notification rules once every *heartbeat* seconds.

## Author

Paul Reeve <*preeve_at_pdjr_dot_eu*>
