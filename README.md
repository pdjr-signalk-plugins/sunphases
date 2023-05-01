# pdjr-skplugin-sunphases

Inject sunlight phase data into Signal K.

## Background

Quite a few things I want to automate on my ship depend upon having
some notion of the phases of a day.
For example, there are times when I want to turn on my anchor light
at dusk and turn it off at dawn; or maybe ring eight-bells at midday.
Whatever.

## Description

__pdjr-skplugin-sunphases__ uses Vladimir Agafonkin's
[SunCalc](https://github.com/mourner/suncalc)
library to calculate sunlight phases (times for sunrise, sunset, dusk,
etc.) for the vessel's current location and injects the resulting time
values into the Signal K state.

Using these values as a starting point, you can define as many simple
rules as you need to raise and cancel notifications as sunlight phase
events occur during the day.

A vanilla installation of __pdjr-skplugin-sunphases__ manages two
notifications, 'notifications.daytime' and 'notifications.nighttime'. 

## Configuration

__pdjr-skplugin-sunphases__ is enabled by default and operates autonomously.


This project implements a plugin for the
[Signal K Node server](https://github.com/SignalK/signalk-server-node).

Reading the [Alarm, alert and notification handling](http://signalk.org/specification/1.0.0/doc/notifications.html)
section of the Signal K documentation may provide helpful orientation.


Using these values as a starting point, you can define as many simple
rules as you need to raise and cancel notifications as sunlight phase
events occur during the day.

A vanilla installation of __pdjr-skplugin-sunphases__ manages two
notifications, 'notifications.daytime' and 'notifications.nighttime'. 

## Using the plugin


The plugin can be configured using the Signal K Node server plugin
configuration GUI.
The configuration interface lets you maintain the following properties.
 
__Path under which to store sun phase keys__ [root]\
This required string property tells the plugin where in the Signal K
data store it should place sun phase data.
The default value is 'environment.sunphases.'.

The key/values inserted under [root] are those defined as properties in
the object returned by a call to
[SunCalc.getTimes()](https://github.com/mourner/suncalc#sunlight-times).
You can get the plugin to log a list of the generated keys and their
values by setting the debug key 'sunphases'.

__Heartbeat__ [interval]\
This required number property defines how frequently the plugin should
refresh its data.
At each [interval] the plugin will:

1. Refresh the keys under [root] if the vessel position has changed by
more than one degree of latitude or longitude or if Zulu time has
rolled over into a new day.

2. Process all defined notification rules.
 
The default value for [interval] is 600 which will cause the plugin to
perform a refresh every 10 minutes.

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

__Notification key__ [key]\
This required string property specifies an key under which the
notification will be placed.
The full key path will be 'notifications.*root*.*key*'.

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

__pdjr-skplugin-sunphases__ understands the 'sunphases' debug token.

## Author

Paul Reeve <preeve@pdjr.eu>\
September 2020

