var
  _ = require("lodash"),
  async = require("async"),
  debug = require("debug")("tjfs:validate"),
  util = require("./util.js"),
  generateStartList = require("./startList.js"),
  THRESHOLD = 2,
  LINE_THRESHOLD = 0.15;

function wrapError(msg, source) {
  var wrapper = new Error(msg);
  wrapper.source = source;
  return wrapper;
}

module.exports = function validateResults(seriesName, seriesYear, comp, runGroup, callback) {
  var errors = [];
  async.auto({

    "startList": function (cb) {
      generateStartList(seriesName, seriesYear, comp, runGroup, {format: "array"},
      function handleStartList(startListErr, startList) {
        if (startListErr) {
          return cb(wrapError("Start List", startListErr));
        }
        cb(null, startList);
      });
    },

    "rawResults": function (cb) {
      util.retrieveFromS3(seriesName + seriesYear + "/" + comp + "/results/" + runGroup + ".json",
      function handleResults(rawErr, rawData) {
        if (rawErr) {
          return cb(wrapError("Results", rawErr));
        }
        return cb(null, rawData);
      });
    },

    "validation": [
      "startList", "rawResults",
      function (cb, results) {
        var expectedKeys = ["line", "control", "fluidity", "technique", "style"];
        _.each(results.startList, function validateAthlete(a) {
          var
            result = results.rawResults[a.bib],
            clean = true;
          if (!result) {
            errors.push(new Error("Missing results for bib #" +
              a.bib + " (" + a.firstName + " " + a.lastName + ")"));
            return;
          } else {
            // Look for missing scores and scores over 10 or under 0
            _.each(result.scores, function checkJudge(judge, judgeIx) {
              // debug("[debug] scores for bib #%s for judge #%s: %j", a.bib, judgeIx + 1, judge);
              _.each(expectedKeys, function checkKey(key) {
                // debug("[debug] score for bib #%s, judge #%s, '%s'=%s, type=%s",
                //   a.bib, judgeIx + 1, key, judge[key], typeof judge[key]);
                if (judge[key] === undefined || judge[key] === null || typeof judge[key] !== "number") {
                  errors.push(new Error("Missing '" + key + "' score for judge #" +
                    (judgeIx + 1) + " for bib #" + a.bib));
                  clean = false;
                } else if (judge[key] < 0) {
                  errors.push(new Error("'" + key + "' score for judge #" + judgeIx + 1 + " <0"));
                  clean = false;
                } else if (judge[key] > 10) {
                  errors.push(new Error("'" + key + "' score for judge #" + judgeIx + 1 + " >10"));
                  clean = false;
                }
              });
            });
          }
          if (clean) {
            // Check for score discrepancies
            _.each(expectedKeys, function compare(key) {
              var
                min = 99,
                max = 0;
              _.each(result.scores, function checkJudge(judge, judgeIx) {
                min = Math.min(judge[key], min);
                max = Math.max(judge[key], max);
              });
              if (key === "line") {
                if (max - min >= LINE_THRESHOLD) {
                  errors.push(new Error("line difference of " + (max - min) +
                    " for bib #" + a.bib + " (" + a.firstName + " " + a.lastName +
                    ")"));
                }
              } else if (max - min >= THRESHOLD) {
                errors.push(new Error(key + " difference of " + (max - min) +
                  " for bib #" + a.bib + " (" + a.firstName + " " + a.lastName +
                  ")"));
              }
            });
          }
        });
        cb();
      }
    ]

  },
  function doneValidating(err, results) {
    if (err) {
      // A blocking error occurred that prevents further analysis.
      // Just return that one.
      debug("[error] blocking error: %s, %j", err.message, err);
      errors.push(err);
    }
    debug("[info] errors: %j", errors);
    callback(null, errors);
  });
};
