# signalk-sunphases

Inject sunlight phase data into Signal K.

This project implements a plugin for the
[Signal K Node server](https://github.com/SignalK/signalk-server-node).

Reading the [Alarm, alert and notification handling](http://signalk.org/specification/1.0.0/doc/notifications.html)
section of the Signal K documentation may provide helpful orientation.

__signalk-sunphases__ uses Vladimir Agafonkin's
[SunCalc](https://github.com/mourner/suncalc)
library to calculate sunlight phases (times for sunrise, sunset, dusk,
etc.) for the vessel's current location and injects the resulting time
values into the Signal K state model (by default as paths under
"environment.sunphases").

Using these values as a starting point, you can define as many simple
rules as you need to raise and cancel notifications as sunlight phase
events occur during the day.

A vanilla installation of __signalk-sunphases__ manages two notifications,
"notifications.daytime" and "notifications.nighttime". 

## System requirements

__signalk-sunphases__ requires that the the 'baconjs' and 'suncalc' npm's
are available in your Node server context.
If the module claims they are not found, you can install them locally
to the plugin by changing to the plugin directory and issuing the
following commands.
```
$> npm install baconjs
$> npm install suncalc
```

## Installation

Download and install __signalk-sunphases__ using the "Appstore" menu
option in your Signal K Node server console.
The plugin can also be obtained from the 
[project homepage](https://github.com/preeve9534/signalk-sunphases)
and installed using
[these instructions](https://github.com/SignalK/signalk-server-node/blob/master/SERVERPLUGINS.md).

The plugin is enabled by default: once installed you should find the
keys it maintains under "environment.sunphases...." and "notifications....".

## Using the plugin

__signalk-sunphases__ operates autonomously.

The plugin can be configured using the Signal K Node server plugin
configuration GUI, or you can just edit the plugin's JSON configuration
file 'sunphases.json' using your preferred text editor.
 
The default configuration illustrates the general structure:
```
{
  "enabled": true,
  "enableLogging": false,
  "enableDebug": false,
  "configuration": {
    "interval": 600,
    "root": "environment.sunphases",
    "notifications": [
      {
        "rangelo": "dawn",
        "rangehi": "dusk",
        "inrangenotification": {
          "path": "notifications.daytime"
        },
        "outrangenotification": {
          "path": "notifications.nighttime"
        }
      }
    ]
  }
}
```

When __signalk-sunphases__  starts, and shortly after midnight Zulu time
it computes sun phase values for the current day and stores them in
keys under the specified __root__ (see below). 

The required __interval__ property introduces a natural number value
that defines how many seconds should elapse between notification
updates.
The default value is 600 which will cause the plugin to check and if
necessary update notifications every 10 minutes.
Setting the __interval__ value to 0 will cause the plugin to process
notifications immediately that it is retsarted and then never again:
useful for testing, but not much else.

The required __root__ property introduces a string value that defines
the path under which the plugin will store sun phase data. 
The default value is "environment.sunphases".
The keys and the values that are inserted here are those defined as
properties in the object returned by a call to
[SunCalc.getTimes()](https://github.com/mourner/suncalc#sunlight-times).
You can get the plugin to log a list of the generated keys and their
values by setting the debug key 'sunphases:keys'.

The required __notifications__ property introduces an array that
can contain an arbitrary number of notification definitions.
Each definition identifies a time period and the notifications that
should be raised when the current time of day is within and outside of
this range.
The time limits can be specified as SunCalc key names (optionally with
some arithmetic tweaking) or as absolute Zulu times.
Bear in mind that __signalk-sunphases__ wass not designed to be a
real-time scheduler and that its utility in this role is severely
hampered by the time granularity implied by the value of __interval__.

Each object in the __notifications__ array is defined in the following
way.

The required __rangelo__ property introduces a string value that
specifies the time of the start of the notification period.
The required format for value is
"( *key*[(__+__|__-__)*n*(__h__|__m__|__s__)] | *hh*__:__*mm*__:__*ss* )",
where *key* is the name of a SunCalc key (and may be all you need).

The required __rangehi__ property introduces a string value that
specifies the time of the end of the notification period.
See __rangelo__ above for the format considerations.

The optional __inrangenotification__ property introduces an object
that defines the notification that should be raised when the current
time of day is within the range __rangelo__...__rangehi__.

The optional __outrangenotification__ property introduces an object
that defines the notification that should be raised when the current
time of day is outside the range __rangelo__...__rangehi__.

The notification definition object specified by __inrangenotification__
and __outrangenotification__ is defined in the following way:

The required __path__ property introduces a string which specifies the
path of the desired notification.

The optional __state__ property introduces a string that specifies the
the value to be used for the state property of any raised notification.
If __state__ is omitted, then this value will default to "normal".

The optional __method__ property introduces a string array thats
specifies the value to be used for the method property of any raised
notification.
If __method__ is omitted, then this value will default to [].

## Debugging and logging

__signalk-sunphases__ logs summary status information to the Signal K
dashboard.

The plugin also responds in a more fulsome way to the following debug
keys.

| Key                   | Meaning                       |
|:----------------------|:------------------------------|
| sunphases:\*            | Enable all keys.              |
| sunphases:keys          | Log generated sun phase keys. |
| sunphases:notifications | Log notification updates.     |
