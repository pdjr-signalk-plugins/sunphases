# pdjr-skplugin-sunphases

Inject sunlight phase data into Signal K.

## Background

Quite a few things I want to automate on my ship depend upon having
some notion of the phases of a day.
For example, there are times when I want to turn on my anchor light
at dusk and turn it off at dawn; or maybe ring eight-bells at midday.
Whatever.

## Description

__pdjr-skplugin-sunphases__ implements a both a sunphase engine and an
associated notification generator.

The sunphase engine injects sunlight phases (times for sunrise, sunset,
dusk, etc.) into the Signal K state.
Values are calculated at midnight local time and recaclculated each
time the vessel's position changes significantly using Vladimir
Agafonkin's [SunCalc](https://github.com/mourner/suncalc) library.

The notification generator implements a simple rule processor which
uses sunphase data and a collection of user-defined rules to raise
notifications advising sunphase conditions.

A vanilla installation of __pdjr-skplugin-sunphases__ manages two
such rules which raise a 'notifications.environment.sunphase.daytime'
notification between dawn and dusk and a
'notifications.environment.sunphases.nighttime' notification between
dusk and dawn.

The user can configure the notification rule set to suit their own
requirements.  

## Configuration

The plugin understands the follwing configuration properties.

| Property      | Default                  | Decription |
| :------------ | :----------------------- | :--------- |
| root          | 'environment.sunphases.' | The path under which to store sun phase keys. |
| heartbeat     | 60                       | Time in seconds between evaluation of data updates and rule processing. |
| notifications | []                       | Array of notification rules (see below) |

The value of the *root* property determines both the root under which
sunphase keys will be stored and also the root under which any
generated notifications will be placed (this will always be 'notifications.*root*').

The *heartbeat* property defines how frequently the plugin should
refresh its data.
At each *heartbeat* the plugin will:

1. Refresh the keys under *root* if the vessel position has changed by
   more than one degree of latitude or longitude or if Zulu time has
   rolled over into a new day.

2. Process all defined notification rules.

The default value for *heartbeat* is 60 which will cause the plugin to
perform a refresh every minute.

The *notifications* array property consists of one or more notification
rules each of which identifies a time window and the notifications that
should be raised when the current time of day is within and outside of
this range.

Each notification rule can include the following properties.

| Property             | Default | Description |
| :------------------- | :------ | :---------- |
| rangelo              | (none)  | Required string specifying the in-range start time. |
| rangehi              | (none)  | Required string specifying the in-range end time. |
| inrangenotification  | (none)  | Optional object specifying the notification to be raised when the current time of day is between *rangelo* and *rangehi*. |
| outrangenotification | (none)  | Optional object specifying the notification to be raised when the current time of day is outwith *rangelo* and *rangehi*. |

*rangelo* and *rangehi* can be specified as SunCalc key names
(optionally with some arithmetic tweaking) or as absolute Zulu times.
The required format is:

( *key*[(__+__|__-__)*n*(__h__|__m__|__s__)] | *hh*__:__*mm*__:__*ss* )

where *key* is the name of a SunCalc key (and may be all you need).

*inrangenotification* and *outrangenotification* are objects with three
properties which define a notification.

| Property | Default  | Description |
| :------- | :------- | :---------- |
| key      | (none)   | Required string specifying the name under which the notification will be placed (the full key name will be 'notifications.*root*.*key*'). |
| state    | "normal" | Optional string property specifying the value of the notification state field. |
| method   | []       | Optional string array suggesting the methods that might be used to anounce the notification. |

## Operation

The plugin will update key values and process notification rules once
every *heartbeat* seconds.

## Author

Paul Reeve <preeve_at_pdjr_dot_eu>
