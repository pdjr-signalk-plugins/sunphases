/**
 * Copyright 2020 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const suncalc = require('suncalc');

const Log = require("./lib/signalk-liblog/Log.js");
const Schema = require("./lib/signalk-libschema/Schema.js");

const PLUGIN_SCHEMA_FILE = __dirname + "/schema.json";
const PLUGIN_UISCHEMA_FILE = __dirname + "/uischema.json";

const DEFAULT_OPTIONS_INTERVAL = 600;
const DEFAULT_OPTIONS_ROOT = "environment.sunphases";

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];

  plugin.id = 'sunphases';
  plugin.name = 'Sunlight phase calculator';
  plugin.description = 'Inject sunlight phase paths into Signal K.';

  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });

  plugin.schema = function() {
    var schema = Schema.createSchema(PLUGIN_SCHEMA_FILE);
    return(schema.getSchema());
  };

  plugin.uiSchema = function() {
    var schema = Schema.createSchema(PLUGIN_UISCHEMA_FILE);
    return(schema.getSchema());
  }

  plugin.start = function(options) {
    if ((!options) || (Object.keys(options).length == 0)) {
      options = { "interval": DEFAULT_OPTIONS_INTERVAL, "root": DEFAULT_OPTIONS_ROOT, "notifications": [] };
      log.W("using built-in defaults %s", JSON.stringify(options));
    }
    options.root = options.root.trim().replace(/^\.+|\.+$/g,'') + ".";
     
    log.N("maintaining keys in (%s)", options.root);

    // Publish meta information for all maintained keys
    //
    var deltas = options.metadata.map(entry => ({ "path": options.root + entry.key + ".meta", "value": { "description": entry.description } }));
    if (deltas.length) app.handleMessage(plugin.id, makeDelta(plugin.id, deltas)); 

    //
    var positionStream = app.streambundle.getSelfStream("navigation.position");
    positionStream = (options.interval == 0)?positionStream.take(1):positionStream.debounceImmediate(options.interval * 1000);

    unsubscribes.push(
      positionStream.onValue(position => {
        var now = new Date();
        var today = dayOfYear(now);
        var deltas = [];

        /**************************************************************
         * Add sunphase key updates to <deltas> if this is the first
         * time around or if we have entered a new day or if our
         * position has changed significantly.
         */

        options.lastLatitude = 0.0;
        options.lastLongitude = 0.0;
        if ((!options.lastupdateday) || (options.lastupdateday != today)  || (Math.abs(options.lastLatitude - position.latitude) > 1.0) || (Math.abs(options.lastLongitude - position.longitude) > 1.0)) {
          if (options.times = suncalc.getTimes(now, position.latitude, position.longitude)) {
            deltas = Object.keys(options.times).map(k => {
                var delta = { "path": options.root + k, "value": options.times[k].toISOString() };
                app.debug("injecting keys %s: ", JSON.stringify(delta));
                return(delta);
            });
            options.lastupdateday = today;
            options.lastLatitude = 0.0;
            options.lastLongitude = 0.0;
          } else {
            log.E("unable to compute sun phase data");
          }
        }

        /**************************************************************
         * Check that we actually recovered a sun phase data into
         * <options.times> and if so, add notification key updates to
         * <deltas>.
         */

        if (options.times) {
          options.notifications.forEach(notification => {
            try {
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
                  deltas.push({
                    "path": "notifications." + options.root + notification.inrangenotification.key,
                    "value": {
                      "message": "Between " + notification.rangelo + " and " + notification.rangehi,
                      "state": notification.inrangenotification.state || "normal",
                      "method": notification.inrangenotification.method || []
                    }
                  });
                  app.debug("issuing notifications: %s", JSON.stringify(deltas[deltas.length - 1]));
                  // And add a delete out-of-range notification delta to deltas.
                  deltas.push({ "path": notification.outrangenotification.path, "value": null });
                  notification.actioned = 1;
                }
              } else {
                if (notification.outrangenotification.key && (!notification.actioned || (notification.action  != -1))) {
                  deltas.push({
                    "path": "notifications." + options.root + notification.outrangenotification.key,
                    "value": {
                      "message": "Outside " + notification.rangelo + " and " + notification.rangehi,
                      "state": notification.outrangenotification.state || "normal",
                      "method": notification.outrangenotification.method || []
                    }
                  });
                  app.debug("issuing notifications: %s", JSON.stringify(deltas[deltas.length - 1]));
                  deltas.push({ "path": notification.inrangenotification.path, "value": null });
                  notification.actioned = -1;
                }
              }              
            } catch(e) {
              log.E(e);
            }
          });
        }
        // Finally, push our collection of deltas to Signal K.
        if (deltas.length) app.handleMessage(plugin.id, makeDelta(plugin.id, deltas));
      })
    );
  }

  plugin.stop = function () {
    plugin.unsubscribes.forEach(f => f())
  }

  /******************************************************************
   * Return a delta from <pairs> which can be a single value of the
   * form { path, value } or an array of such values.
   */

  function makeDelta(pluginId, pairs) {
    pairs = (Array.isArray(pairs))?pairs:[pairs]; 
    return({
      "updates": [
        {
          "source": { "type": "plugin", "src": pluginId, },
          "timestamp": (new Date()).toISOString(),
          "values": pairs.map(p => { return({ "path": p.path, "value": p.value }); }) 
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
