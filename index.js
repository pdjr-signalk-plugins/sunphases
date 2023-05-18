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
const Log = require("./lib/signalk-liblog/Log.js");
const Delta = require("./lib/signalk-libdelta/Delta.js");

const PLUGIN_ID = 'sunphases';
const PLUGIN_NAME = 'pdjr-signalk-sunphases';
const PLUGIN_DESCRIPTION = 'Inject sunlight phase paths into Signal K';

const DEFAULT_OPTIONS_ROOT = "environment.sunphases.";
const DEFAULT_OPTIONS_HEARTBEAT = 60;
const DEFAULT_OPTIONS_NOTIFICATIONS = [
  { "rangelo": "dawn", "rangehi": "dusk", "inrangenotification": { "key": "daytime" }, "outrangenotification": { "key": "nighttime" } }
];
const DEFAULT_OPTIONS_METADATA = [
  { "key": "dawn", "units": "UTC", "description": "Morning nautical twilight ends, morning civil twilight starts" },
  { "key": "dusk", "units": "UTC", "description": "Evening nautical twilight starts" },
  { "key": "goldenHour", "units": "UTC", "description": "Evening golden hour starts" },
  { "key": "goldenHourEnd", "units": "UTC", "description": "Soft light, best time for photography ends" },
  { "key": "nadir", "units": "UTC", "description": "Darkest moment of the night, sun is in the lowest position" },
  { "key": "nauticalDawn", "units": "UTC", "description": "Morning nautical twilight starts" },
  { "key": "nauticalDusk", "units": "UTC", "description": "Evening astronomical twilight starts" },
  { "key": "night", "units": "UTC", "description": "Dark enough for astronomical observations" },
  { "key": "nightEnd", "units": "UTC", "description": "Morning astronomical twilight starts" },
  { "key": "solarNoon", "units": "UTC", "description": "Sun is at its highest elevation" },
  { "key": "sunrise", "units": "UTC", "description": "Top edge of the sun appears on the horizon" },
  { "key": "sunriseEnd", "units": "UTC", "description": "Bottom edge of the sun touches the horizon" },
  { "key": "sunset", "units": "UTC", "description": "Sun disappears below the horizon, evening civil twilight starts" },
  { "key": "sunsetStart", "units": "UTC", "description": "Bottom edge of the sun touches the horizon" }
];

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;

  plugin.schema = {
    "type": "object",
    "properties": {
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
        }
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
        }
      }
    },
    "required": [ "root", "heartneat" ]
  };
    
  plugin.uischema = {};

  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });

  plugin.start = function(options) {

    if (options) {
      options.root = (options.root)?options.root:DEFAULT_OPTIONS_ROOT;
      options.heartbeat = (options.heartbeat)?options.heartbeat:DEFAULT_OPTIONS_HEARTBEAT;
      options.notifications = (options.notifications)?options.notifications:DEFAULT_OPTIONS_NOTIFICATIONS;
      options.metadata = (options.metadata)?options.metadata:DEFAULT_OPTIONS_METADATA;
      
      log.N("maintaining keys in '%s'", options.root);

      var delta = new Delta(app, plugin.id);

      // Publish meta information for all maintained keys
      //
      if ((options.metadata) && Array.isArray(options.metadata) && (options.metadata.length > 0)) {
        options.metadata.map(entry => delta.addMeta(options.root + entry.key, { "description": entry.description, "units": "ISO-8601 (UTC)" }));
        delta.commit();
      } else {
        log.W("no metadata available - please add to plugin configuration schema");
      }

      // Get a stream that reports vessel position and sample it at the
      // requested interval.
      //
      var positionStream = app.streambundle.getSelfStream("navigation.position");
      if (positionStream) { 
        log.N("waiting for position update");
        positionStream = (options.heartbeat == 0)?positionStream.take(1):positionStream.debounceImmediate(options.heartbeat * 1000);
        unsubscribes.push(
          positionStream.onValue(position => {
            log.N("processing position change for %s", JSON.stringify(position));
            var now = new Date();
            var today = dayOfYear(now);
            var delta = new Delta(app, plugin.id);

            /**************************************************************
             * Add sunphase key updates to <deltas> if this is the first
             * time around or if we have entered a new day or if our
             * position has changed significantly.
             */
            options.lastLatitude = 0.0;
            options.lastLongitude = 0.0;
            if ((!options.lastupdateday) || (options.lastupdateday != today)    || (Math.abs(options.lastLatitude - position.latitude) > 1.0) || (Math.abs(options.lastLongitude - position.longitude) > 1.0)) {
              if (options.times = suncalc.getTimes(now, position.latitude, position.longitude)) {
                Object.keys(options.times).forEach(k => delta.addValue(options.root + k, options.times[k].toISOString()));
                options.lastupdateday = today;
                options.lastLatitude = 0.0;
                options.lastLongitude = 0.0;
              } else {
                log.E("unable to compute sun phase data");
              }
            }

            /**************************************************************
             * Check that we actually recovered sun phase data into
             * <options.times> and if so, add notification key updates to
             * <deltas>.
             */
            if (options.times) {
              options.notifications.forEach(notification => {
                try {
                  // Build in-range and out-range notification paths.
                  var nirpath = "notifications." + options.root + notification.inrangenotification.key;
                  var norpath = "notifications." + options.root + notification.outrangenotification.key;
                  // Get the times of interest as seconds in this day.
                  now = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
                  var start = parseTimeString(notification.rangelo, options.times);
                  var end = parseTimeString(notification.rangehi, options.times);
                  // Is this an "in-range" or "out-of-range" update?
                  if ((now > start) && (now < end)) {
                    // It's "in-range". Is there an "in-range" notification path?
                    // If so and we haven't made this update already...
                    if (notification.inrangenotification.key && (!notification.actioned || (notification.actioned != 1))) {
                      // Add a create in-range notification delta to deltas.
                      delta.addValue(nirpath, {
                        message: "Between " + notification.rangelo + " and " + notification.rangehi,
                        state: notification.inrangenotification.state || "normal",
                        method: notification.inrangenotification.method || []
                      });
                      // And add a delete out-of-range notification delta to deltas.
                      delta.addValue(norpath, null);
                      notification.actioned = 1;
                    }
                  } else {
                    if (notification.outrangenotification.key && (!notification.actioned || (notification.action    != -1))) {
                      delta.addValue(norpath, {
                        message: "Outside " + notification.rangelo + " and " + notification.rangehi,
                        state: notification.outrangenotification.state || "normal",
                        method: notification.outrangenotification.method || []
                      });
                      delta.addValue(nirpath, null);
                      notification.actioned = -1;
                    }
                  }                            
                } catch(e) {
                  log.E(e);
                }
              });
            }
            // Finally, push our collection of deltas to Signal K.
            delta.commit();
          })
        );
      } else {
        log.E("stopped: unable to obtain vessel position");
      }
    }
  }

  plugin.stop = function () {
    plugin.unsubscribes.forEach(f => f())
  }

  /******************************************************************
   * Return a delta from <pairs> which can be a single value of the
   * form { path, value } or an array of such values.
   */

  function makeDelta(pluginId, pairs, type="values") {
    pairs = (Array.isArray(pairs))?pairs:[pairs]; 
    return({
      "updates": [
        {
          "source": { "type": "plugin", "src": pluginId, },
          "timestamp": (new Date()).toISOString(),
          [type]: pairs
        }
      ]
    });
  }

  function dayOfYear(date){
    return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000;
  }

  function parseTimeString(s, sunphases) {
    var retval, matches, date;
    s = s.trim();
    if (matches = s.match(/^(\d\d):(\d\d):(\d\d)$/)) {
      if (((1 * matches[1]) < 24) && ((1 * matches[2]) < 60) && ((1 * matches[3]) < 60)) {
        retval = (3600 * matches[1]) + (60 * matches[2]) + (1 * matches[3]);
      } else {
        throw "hh:mm:ss value is invalid";
      }
    } else if (matches = s.match(/^(\w+)$/)) {
      if (sunphases.hasOwnProperty(matches[1])) {
        date = sunphases[matches[1]];
        retval = (3600 * date.getHours()) + (60 * date.getMinutes()) + (1 * date.getSeconds());
      } else {
        throw "invalid sun phase key '" + matches[1] + "'";
      }
    } else if (matches = s.match(/^(\w+)(\+|\-)(\d+)(h|m|s)$/)) {
      if (sunphases.hasOwnProperty(matches[1])) {
        date = sunphases[matches[1]];
        retval = (3600 * date.getHours()) + (60 * date.getMinutes()) + (1 * date.getSeconds());
        switch (matches[4]) {
          case 'h': retval += (((matches[2] == "+")?1:-1) * matches[3] * 3600)
            break;
          case 'm': retval += (((matches[2] == "+")?1:-1) * matches[3] * 60)
            break;
          case 's': retval += (((matches[2] == "+")?1:-1) * matches[3])
            break;
        }
      } else {
        throw "invalid sun phase key '" + matches[1] + "'";
      }
    } else {
      throw "error parsing '" + s + "'";
    }
    return(retval);
  }

  return plugin
}
