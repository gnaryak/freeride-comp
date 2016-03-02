var
  _ = require("lodash"),
  async = require("async"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:validate"),
  util = require("./util.js"),
  generateStartList = require("./startList.js"),
  THRESHOLD = 2,
  LINE_THRESHOLD = 0.01,
  SCORE_MATTERS = 0.35;

function wrapError(msg, source) {
  var wrapper = new Error(msg);
  wrapper.source = source;
  return wrapper;
}

function createValidationError(msg, athlete) {
  var err = new Error(msg);
  err.athlete = athlete;
  err.bib = athlete.bib;
  err.division = athlete.division;
  err.athleteName = athlete.firstName + " " + athlete.lastName;
  return err;
}

/**
 * Supported options are "array" or "csv" (default).
 */
module.exports = function validateResults(seriesName, seriesYear, comp, runGroup, options, callback) {
  options = options || {};
  options.format = options.format || "csv";
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
        var
          expectedKeys = ["line", "control", "fluidity", "technique", "style"],
          maxScore = 10 * expectedKeys.length,
          relevantScore = maxScore * SCORE_MATTERS;
        console.log("relevantScore=%d", relevantScore);
        _.each(results.startList, function validateAthlete(a) {
          console.log("athlete=%j", a);
          var
            result = results.rawResults[a.bib],
            clean = true;
          if (!result) {
            errors.push(createValidationError("Missing results for bib #" +
              a.bib + " (" + a.firstName + " " + a.lastName + ")", a));
            return;
          } else {
            // Look for missing scores and scores over 10 or under 0
            _.each(result.scores, function checkJudge(judge, judgeIx) {
              // debug("[debug] scores for bib #%s for judge #%s: %j", a.bib, judgeIx + 1, judge);
              _.each(expectedKeys, function checkKey(key) {
                // debug("[debug] score for bib #%s, judge #%s, '%s'=%s, type=%s",
                //   a.bib, judgeIx + 1, key, judge[key], typeof judge[key]);
                if (judge[key] === undefined || judge[key] === null || typeof judge[key] !== "number") {
                  errors.push(createValidationError("Missing '" + key + "' score for judge #" +
                    (judgeIx + 1) + " for bib #" + a.bib, a));
                  clean = false;
                } else if (judge[key] < 0) {
                  errors.push(createValidationError("'" + key + "' score for judge #" +
                    (judgeIx + 1) + " <0 for bib #" + a.bib, a));
                  clean = false;
                } else if (judge[key] > 10) {
                  errors.push(createValidationError("'" + key + "' score for judge #" +
                    (judgeIx + 1) + " >10 for bib #" + a.bib, a));
                  clean = false;
                }
              });
            });
          }
          // console.log("relevantScore=%d, athleteScore=%d", relevantScore, result.score);
          if (clean && (result.score >= relevantScore)) {
            // The score is high enough to matter so check for score discrepancies
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
                  errors.push(createValidationError("line difference of " + (max - min) +
                    " for bib #" + a.bib + " (" + a.firstName + " " + a.lastName +
                    ")", a));
                }
              } else if (max - min >= THRESHOLD) {
                errors.push(createValidationError(key + " difference of " + (max - min) +
                  " for bib #" + a.bib + " (" + a.firstName + " " + a.lastName +
                  ")", a));
              }
            });
          }
        });
        cb();
      }
    ],

    "csv": [
      "validation",
      function createCsv(done, results) {
        if (options.format !== "csv") {
          // Skip this step
          return done();
        }
        var output = _.map(errors, function csvify(e) {
          return [e.bib, e.division, e.athleteName, e.message];
        });
        output.unshift(["Bib", "Division", "Name", "Error"]);
        csv.writeToString(output, {headers: true}, done);
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
    if (options.format === "csv") {
      callback(null, results.csv);
    } else {
      callback(null, errors);
    }
  });
};
