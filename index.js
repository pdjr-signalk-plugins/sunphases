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
const PLUGIN_SCHEMA = {
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
};
const PLUGIN_UISCHEMA = {};

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uischema = PLUGIN_UISCHEMA;

  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });
  const delta = new Delta(app, plugin.id);

  plugin.start = function(options) {

    // If missing or partial configuration, then use our built-in default.
    options.positionkey = (options.positionkey || plugin.schema.properties.positionkey.default);
    options.root = (options.root || plugin.schema.properties.root.default);
    options.heartbeat = (options.heartbeat || plugin.schema.properties.heartbeat.default);
    options.metadata = (options.metadata || plugin.schema.properties.metadata.default);
    options.notifications = (options.notifications || plugin.schema.properties.notifications.default);

    log.N("maintaining keys in '%s' (heartbeat is %ds)", options.root, options.heartbeat);

    // Publish meta information for all maintained keys.
    if (options.metadata) {
      options.metadata.map(entry => delta.addMeta(options.root + entry.key, { "description": entry.description, "units": entry.units }));
      delta.commit().clear();
    }
      
    // Get a stream that reports vessel position and sample it at the
    // requested interval.
    options.lastday = 0;
    options.lastposition = { "latitude": 0.0, "longitude": 0.0 };

    var positionStream = app.streambundle.getSelfStream(options.positionkey);
    if (positionStream) { 
      log.N("waiting for position update", false);
      positionStream = (options.heartbeat == 0)?positionStream.take(1):positionStream.debounceImmediate(options.heartbeat * 1000);
      unsubscribes.push(positionStream.onValue(position => {
        var now = new Date();
        var today = dayOfYear(now);

        // Add sunphase key updates to <deltas> if this is the first
        // time around or if we have entered a new day or if our
        // position has changed significantly.
        if ((options.lastday != today) || (Math.abs(options.lastposition.latitude - position.latitude) > 1.0) || (Math.abs(options.lastposition.longitude - position.longitude) > 1.0)) {
          if (options.lastday != today) {
            app.debug("updating sunphase data for day change from %d to %d", options.lastday, today);
          } else {
		        app.debug("updating sunphase data for position change from %s to %s", JSON.stringify(options.lastposition), JSON.stringify(position));
          }

          if (options.times = suncalc.getTimes(now, position.latitude, position.longitude)) {
            Object.keys(options.times).forEach(k => delta.addValue(options.root + k, options.times[k]));
          } else {
            log.E("unable to compute sun phase data", false);
          }
              
          options.lastday = today;
          options.lastposition = position;
        }

        // Check that we actually recovered sun phase data into
        // <options.times> and if so, add notification key updates to
        // <deltas>.
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
        delta.commit().clear();
      }));
    } else {
      log.E("cannot obtain vessel position from '%s'", options.positionkey);
    }
  }

  plugin.stop = function () {
    plugin.unsubscribes.forEach(f => f())
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
