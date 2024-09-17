/**********************************************************************
 * Copyright 2020 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const suncalc = require('suncalc');
const MyApp = require('signalk-libapp/App.js');
const Log = require('signalk-liblog/Log.js');
const Delta = require('signalk-libdelta/Delta.js');

const PLUGIN_ID: string = 'sunphases'
const PLUGIN_NAME: string = 'pdjr-signalk-sunphases'
const PLUGIN_DESCRIPTION: string = 'Inject sunlight phase paths into Signal K'
const PLUGIN_SCHEMA: object = {
  "type": "object",
  "properties": {
    "positionkey": {
       "type": "string",
       "title": "Path reporting vessel position",
       "default": "navigation.position"
    },
    "root": {
      "type": "string",
      "title": "Path under which to store sun phase keys",
      "default": "environment.sunphases."
    },
    "heartbeat": {
      "title": "Heartbeat",
      "type": "number",
      "minimum": 0,
      "default": 60
    },
    "notifications": {
      "type": "array",
      "title": "Notification rules",
      "items": {
        "type": "object",
        "properties": {
          "rangelo": {
            "type": "string",
            "title": "Start of notification ON period"
          },
          "rangehi": {
            "type": "string",
            "title": "End of notification ON period"
          },
          "inrangenotification": {
            "title": "In-range notification",
            "type": "object",
            "properties": {
              "key": {
                "title": "Notification key",
                "type": "string"
              },
              "state": {
                "title": "Notification state",
                "type": "string",
                "default": "normal",
                "enum": [ "normal", "alert", "warn", "alarm", "emergency" ]
              },
              "method": {
                "title": "Notification methods",
                "type": "array",
                "default": [],
                "items": { "type": "string", "enum": [ "visual", "sound" ] },
                "uniqueItems": true
              }
            },
            "required": [ "key" ]
          },
          "outrangenotification": {
          "title": "Out-of-range notification",
          "type": "object",
          "properties": {
            "key": {
              "title": "Notification key",
              "type": "string"
            },
            "state": {
              "title": "Notification state",
              "type": "string",
              "default": "normal",
              "enum": [ "normal", "alert", "warn", "alarm", "emergency" ]
            },
            "method": {
              "title": "Notification methods",
              "type": "array",
              "default": [],
              "items": {
                "type": "string",
                "enum": [ "visual", "sound" ]
              },
              "uniqueItems": true
            }
          },
          "required": [ "key" ]
          }
        },
        "required": [ "rangelo", "rangehi" ]
      },
      "default": [
        {
          "rangelo": "dawn",
          "rangehi": "dusk",
          "inrangenotification": { "key": "daytime" },
          "outrangenotification": { "key": "nighttime" }
        }
      ],
    },
    "metadata": {
      "description": "Meta data for each key",
      "type": "array",
      "items": {
        "type": "object",
        "default": [],
        "properties": {
          "key": {
            "type": "string",
            "enum": [ "dawn", "dusk", "goldenHour", "goldenHourEnd", "nadir", "nauticalDawn", "nauticalDusk", "night", "nightEnd", "solarNoon", "sunrise", "sunriseEnd", "sunset", "sunsetStart" ]
          },
          "description": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "longName": {
            "type": "string"
          },
          "shortName": {
            "type": "string"
          },
          "units": {
            "type": "string"
          }
        }
      },
      "default": [
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
  },
  "required": [ "notifications" ]
}
const PLUGIN_UISCHEMA: object = {}

module.exports = function (app: any) {
  let unsubscribes: (() => void)[] = []

  let options: SKOptions = {
    heartbeat: 0,
    lastday: 0,
    lastposition: { latitude: 0, longitude: 0 },
    metadata: [],
    notifications: [],
    positionkey: '',
    root: '',
    times: null
  }

  const plugin: SKPlugin = {

    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: PLUGIN_DESCRIPTION,
    schema: PLUGIN_SCHEMA,
    uiSchema: PLUGIN_UISCHEMA,

    start: function(props: any) {
      const delta = new Delta(app, plugin.id)

    // Make options with global scope as plugin.options.
    options.positionkey = (props.positionkey || plugin.schema.properties.positionkey.default)
    options.root = (props.root || plugin.schema.properties.root.default)
    options.heartbeat = (props.heartbeat || plugin.schema.properties.heartbeat.default)
    options.notifications = (props.notifications || plugin.schema.properties.notifications.default)
    options.metadata = (props.metadata || plugin.schema.properties.metadata.default)

    app.setPluginStatus(`maintaining keys in '${options.root}' (heartbeat is ${options.heartbeat}s)`)

    // Publish meta information for all maintained keys.
    if (options.metadata !== undefined) {
      options.metadata.forEach((entry) => delta.addMeta(options.root + entry.key, { "description": entry.description, "units": entry.units }));
      delta.commit().clear();
    }
      
    // Get a stream that reports vessel position and sample it at the
    // requested interval.
    options.lastday = 0;
    options.lastposition = { latitude: 0.0, longitude: 0.0 };

    let positionStream = app.streambundle.getSelfStream(options.positionkey);
    if (positionStream) { 
      positionStream = (options.heartbeat == 0)?positionStream.take(1):positionStream.debounceImmediate(options.heartbeat * 1000);
      unsubscribes.push(positionStream.onValue((position: { latitude: number, longitude: number }) => {
        let now = new Date();
        let today = dayOfYear(now);

        // Add sunphase key updates to <deltas> if this is the first
        // time around or if we have entered a new day or if our
        // position has changed significantly.
        if ((options.lastday != today) || (Math.abs(options.lastposition.latitude - position.latitude) > 1.0) || (Math.abs(options.lastposition.longitude - position.longitude) > 1.0)) {
          if (options.lastday != today) {
            app.debug(`updating sunphase data for day change from ${options.lastday} to ${today}`);
          } else {
		        app.debug(`updating sunphase data for position change from ${JSON.stringify(options.lastposition)} to ${JSON.stringify(position)}`);
          }

          if (options.times = suncalc.getTimes(now, position.latitude, position.longitude)) {
            Object.keys(options.times).forEach(k => delta.addValue(options.root + k, options.times[k]));
          } else {
            app.setPluginError("unable to compute sun phase data", false);
          }
          delta.commit().clear();
              
          options.lastday = today;
          options.lastposition = position;
        }

        // Check that we actually recovered sun phase data into
        // <options.times> and if so, add notification key updates to
        // <deltas>.
        if (options.times) {
          options.notifications.forEach((notification: any) => {
            try {
              // Build in-range and out-range notification paths.
              var nirpath = "notifications." + options.root + notification.inrangenotification.key;
              var norpath = "notifications." + options.root + notification.outrangenotification.key;
              // Get the times of interest as seconds in this day.
              let seconds: number = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
              let start = parseTimeString(notification.rangelo, options.times);
              let end = parseTimeString(notification.rangehi, options.times);
              // Is this an "in-range" or "out-of-range" update?
              if ((seconds > start) && (seconds < end)) {
                // It's "in-range". Is there an "in-range" notification path?
                // If so and we haven't made this update already...
                if (notification.inrangenotification.key && (!notification.actioned || (notification.actioned != 1))) {
                  // Add a create in-range notification delta to deltas.
                  app.notify(nirpath, {
                    state: notification.inrangenotification.state || "normal",
                    method: notification.inrangenotification.method || [],
                    message: `Between ${notification.rangelo} and ${notification.rangehi}.`
                  }, plugin.id);
                  // And add a delete out-of-range notification delta to deltas.
                  app.notify(norpath, null, plugin.id);
                  notification.actioned = 1;
                }
              } else {
                if (notification.outrangenotification.key && (!notification.actioned || (notification.action    != -1))) {
                  app.notify(norpath, {
                    state: notification.outrangenotification.state || "normal",
                    method: notification.outrangenotification.method || [],
                    message: `Outside ${notification.rangelo} and ${notification.rangehi}.`
                  }, plugin.id);
                  app.notify(nirpath, null,plugin.id);
                  notification.actioned = -1;
                }
              }                            
            } catch(e) {
              if (e instanceof Error) app.debug(e.message);
            }
          });
        }
      }));
    } else {
      app.setPluginError(`cannot obtain vessel position from '${options.positionkey}'`)
    }
    },

    stop: function () {
      unsubscribes.forEach(f => f())
    }
  }

  return(plugin)
}

function dayOfYear(date: Date): number {
  return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000
}

function parseTimeString(s: string, sunphases: any): number {
  var retval: number
  var date: Date
  var matches: RegExpMatchArray | null

  if (matches = (s.trim()).match(/^(\d\d):(\d\d):(\d\d)$/)) {
    if (((1 * Number(matches[1])) < 24) && ((1 * Number(matches[2])) < 60) && ((1 * Number(matches[3])) < 60)) {
      retval = (3600 * Number(matches[1])) + (60 * Number(matches[2])) + (1 * Number(matches[3]));
    } else {
      throw "hh:mm:ss value is invalid";
    }
  } else if (matches = (s.trim()).match(/^(\w+)$/)) {
    if (sunphases.hasOwnProperty(matches[1])) {
      date = new Date(sunphases[matches[1]]);
      retval = (3600 * date.getHours()) + (60 * date.getMinutes()) + (1 * date.getSeconds());
    } else {
      throw `invalid sun phase key '${matches[1]}'`;
    }
  } else if (matches = s.match(/^(\w+)(\+|\-)(\d+)(h|m|s)$/)) {
    if (sunphases.hasOwnProperty(matches[1])) {
      date = new Date(sunphases[matches[1]]);
      retval = (3600 * date.getHours()) + (60 * date.getMinutes()) + (1 * date.getSeconds());
      switch (matches[4]) {
        case 'h': retval += (((matches[2] == "+")?1:-1) * Number(matches[3]) * 3600)
          break;
        case 'm': retval += (((matches[2] == "+")?1:-1) * Number(matches[3]) * 60)
          break;
        case 's': retval += (((matches[2] == "+")?1:-1) * Number(matches[3]))
          break;
      }
    } else {
      throw `invalid sun phase key '${matches[1]}'`;
    }
  } else {
    throw `error parsing '${s}'`;
  }
  return(retval);
}

interface SKPlugin {
  id: string,
  name: string,
  description: string,
  schema: any,
  uiSchema: any,

  start: (options: any) => void,
  stop: () => void
}

interface SKOptions {
  heartbeat: number,
  lastday: number,
  lastposition: { latitude: number, longitude: number },
  metadata: any[],
  notifications: any[],
  positionkey: string,
  root: string,
  times: any
}

