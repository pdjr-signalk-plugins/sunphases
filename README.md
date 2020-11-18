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
values into the Signal K state.

Using these values as a starting point, you can define as many simple
rules as you need to raise and cancel notifications as sunlight phase
events occur during the day.

A vanilla installation of __signalk-sunphases__ manages two
notifications, 'notifications.daytime' and 'notifications.nighttime'. 

## System requirements

__signalk-sunphases__ has no special installation requirements.

## Installation

Download and install __signalk-sunphases__ using the 'Appstore' menu
option in your Signal K Node server console.
The plugin can also be obtained from the 
[project homepage](https://github.com/preeve9534/signalk-sunphases)
and installed using
[these instructions](https://github.com/SignalK/signalk-server-node/blob/master/SERVERPLUGINS.md).

## Using the plugin

__signalk-sunphases__ is enabled by default and operates sutonomously.

The plugin can be configured using the Signal K Node server plugin
configuration GUI.
The configuration interface lets you maintain the following properties.
 
__Path under which to store sunphase keys__ [root]\
This required string property tells the plugin where in the Signal K
data store it should place sun phase data.
The default value is 'environment.sunphases.' and the plugin will
populate this tree when it starts and refresh it each day shortly after
midnight Zulu time.

The key/values inserted under [root] are those defined as properties in
the object returned by a call to
[SunCalc.getTimes()](https://github.com/mourner/suncalc#sunlight-times).
You can get the plugin to log a list of the generated keys and their
values by setting the debug key 'sunphases'.

__Number of seconds between notification updates__ [interval]\
This required number property defines how many seconds should elapse
between notification updates.
The default value is 600 which will cause the plugin to check and if
necessary update notifications every 10 minutes.

Setting [interval] to 0 will cause the plugin to process notifications
immediately that it is retsarted and then never again: useful for
testing, but not much else.

__Notification rules__ [notifications]\
This array property contains a collection of *notification definitions*
each of whcih identifies a time window and the notifications that
should be raised when the current time of day is within and outside of
this range.

Time limits can be specified as SunCalc key names (optionally with some
arithmetic tweaking) or as absolute Zulu times.

Each object in the notification definition has the following
properties.

__Start of notification ON period__ [rangelo]\
This required string property specifies the notification window start
time.
The required format for value is:

&nbsp;&nbsp;&nbsp;&nbsp;( *key*[(__+__|__-__)*n*(__h__|__m__|__s__)] | *hh*__:__*mm*__:__*ss* )

where *key* is the name of a SunCalc key (and may be all you need).

__End of notification ON period__ [rangehi]\
This required string property specifies the notification window end
time.
See [rangelo] above for the format considerations.

__In range notification__ [inrangenotification]\
This set of three properties define the notification that should be
raised when the current time of day is within the range [rangelo] to
[rangehi].

__Notification path__ [path]\
This required string property must specify an absolute notification
path. 

__Notification state__ [state]\
This optional string property specifies the value of the notification
state field.
Choose from the available options.
The default value is 'normal.

__Notification methods__ [method]\
This optional property specifies the values of the notification method
field.
Choose from the available options.
The default is to suggest no notification methods.

__Out of range notification__ [outrangenotification]\
This set of three properties define the notification that should be
raised when the current time of day is outside of the range [rangelo]
to [rangehi].
Notification property semantics are the same as for
[outrangenotification].

## Debugging and logging

__signalk-sunphases__ understands the 'sunphases' debug token.

## Author

Paul Reeve <preeve@pdjr.eu>\
September 2020

