"use strict"

var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  util = require("./util.js"),
  createResults = require("./results.js");

/**
 * Generate random sorting #'s for all the athletes.
 */
/* eslint-disable max-params */
function randomize(compdivisions, competitors, rerandomize, key, done) {
/* eslint-enable max-params */
  console.log("[info] randomize");

  async.waterfall([

    function getPrior(cb) {
      if (rerandomize) {
        return cb(null, {});
      } else {
        // Use the previously generated random numbers
        util.retrieveFromS3(key,
        function handleRandom(randomErr, randomData) {
          if (randomErr) {
            // There was an error retrieving the prior random numbers.
            // They probably don't exist.
            console.log("[warn] no prior random numbers");
            return cb(null, {});
          }
          return cb(null, randomData);
        });
      }
    },

    function generateRandoms(priorRandoms, cb) {
      var randomNums = {};
      if (priorRandoms) {
        randomNums = _.cloneDeep(priorRandoms);
      }
      // Create a map of randoms so that we don't get dups.
      var rMap = {};
      _.forEach(randomNums, function mapify(r) {
        rMap[r] = true;
      });
      _.forEach(competitors, function oneRandom(c) {
        if (!randomNums[c.bib]) {
          // Avoid dups
          // Use an optimistic approach. If we get a dup, just try again.
          var r = Math.floor(Math.random() * (99999 - 1)) + 1;
          while (rMap[r]) {
            console.log("[info] avoiding duplicate random # %s", r);
            r = Math.floor(Math.random() * (99999 - 1)) + 1;
          }
          rMap[r] = true;
          randomNums[c.bib] = r;
        }
      });
      cb(null, randomNums);
    },

    function writeRandoms(randoms, cb) {
      util.writeToS3(key, JSON.stringify(randoms),
      function wrote(writeErr) {
        if (writeErr) {
          return cb(writeErr);
        }
        // Send the random data to the callback, so that it gets supplied to
        // the outer auto.
        cb(null, randoms);
      });
    }

  ], done);
}

/**
 * Randomly sort the athletes in the compdivision.
 */
function randomlySortCompDivision(compDivision, results, comp) {
  // Sort the athletes within that division.
  // Determine the sequence for this division in this comp, so we know
  // which athletes to include.
  var allForDiv = _.filter(results.compdivisions, {comp: compDivision.comp, division: compDivision.division});
  allForDiv = _.sortBy(allForDiv, "orderForDivision");
  var
    ddIx = 0,
    curDD = allForDiv[ddIx];
  while (curDD && (curDD.orderForDivision  !== compDivision.orderForDivision)) {
    ddIx += 1;
    curDD = allForDiv[ddIx];
  }
  ddIx += 1;

  var athletes = _.filter(results.competitorDivisions,
  function filterAthletes(a) {
    return (a.division === compDivision.division && a.bib && a[comp + "-" + ddIx]);
  });
  // Sort the athletes
  athletes = _.sortBy(athletes, function sortAthletes(a) {
    var sortValue = results.random[a.bib];
    if (compDivision.sort === "reverserandom") {
      sortValue = -sortValue;
    }
    // console.log("[debug] %s %s (%s) has a sort value of %s",
    //   a.firstName, a.lastName, a.division, sortValue);
    return sortValue;
  });
  return athletes;
}

/**
 * Sort the competitors in a division for a comp based on their results.
 * They will be sorted in reverse order
 */
function sortCompDivisionByResults(seriesName, seriesYear, compDivision, cb) {
  createResults(seriesName, seriesYear, compDivision.comp,
  {division: compDivision.division, format: "array"},
  function handleResults(resultsErr, athletes) {
    if (resultsErr) {
      return cb(resultsErr);
    }
    athletes = _.filter(athletes, function aboveCutoff(a) {
      var cutoff = parseFloat(compDivision.sort.split(",")[1]);
      return a.score >= cutoff;
    });
    // Flip the order. If the comp breaks ties and there is a tie, then we can't
    // simply sort by score and get the correct order. The array returned from
    // createResults() is guaranteed to have the correct order, including
    // tiebreaking.
    // console.log("[debug] prior to sorting for %s: %j", compDivision.division, athletes);
    athletes.reverse();
    // console.log("[debug] after sorting: %j", athletes);
    cb(null, athletes);
  });
}

/**
 * Generate a start list for the given comp and run group.
 */
/* eslint-disable max-params */
module.exports = function startList(
  seriesName, seriesYear, comp, runGroup, options, callback) {
/* eslint-enable max-params */
  options = options || {};
  options.format = options.format || "csv";
  var
    lookup = options.lookup || false,
    rerandomize = options.rerandomize || false,
    keyPrefix = seriesName + seriesYear + "/";
  async.auto({
    "divisions": function getDivisions(done) {
      util.retrieveFromS3(keyPrefix + "divisions.json", done);
    },

    "compdivisions": function getCompDivisions(done) {
      util.retrieveFromS3(keyPrefix + "compdivisions.json", done);
    },

    "competitions": function getCompetitions(done) {
      util.retrieveFromS3(keyPrefix + "competitions.json", done);
    },

    "competitors": function getCompetitors(done) {
      util.retrieveFromS3(keyPrefix + "competitors.json", done);
    },

    "random": ["competitors", "compdivisions", function handleRandoms(results, done) {
      var
        sorts = _.uniq(_.map(_.filter(results.compdivisions, {comp: comp, runGroup: runGroup}), "sort")),
        usesRandomSort = _.some(sorts, function hasRandom(sort) {
          return (_.includes(sort, "random"));
        });
      if (!usesRandomSort) {
        // We don't need random sorting
        return done();
      } else {
        // We DO need random sorting
        randomize(results.compdivisions, results.competitors, rerandomize,
          keyPrefix + comp + "/random.json", done);
      }

    }],

    "competitorDivisions": ["divisions", "competitors", "competitions",
      function assignCompetitorDivisions(results, done) {
        util.assignCompetitorDivisions(
          results.competitors, results.competitions, results.divisions, comp);
        done(null, results.competitors);
      }],

    "startList": ["compdivisions", "competitorDivisions", "random",
      function createStartList(results, done) {
        console.log("[info] createStartList");
        var rgDivisions = _.filter(results.compdivisions, {comp: comp, runGroup: runGroup});
        rgDivisions = _.sortBy(rgDivisions, "orderInRunGroup");
        console.log("[debug] divisions: %j", rgDivisions);
        async.map(rgDivisions, function mapDivision(cd, cdCb) {
          if (_.includes(cd.sort, "random")) {
            return cdCb(null, randomlySortCompDivision(cd, results, comp));
          } else if (_.startsWith(cd.sort, "cutoff")) {
            return sortCompDivisionByResults(seriesName, seriesYear, cd, cdCb);
          } else {
            cdCb(new Error("Illegal sort: " + cd.sort));
          }
        },
        function handleAthletes(mapErr, athleteDivisions) {
          // Flatten the nested arrays into a single array
          athleteDivisions = _.flatten(athleteDivisions);
          done(null, athleteDivisions);
        });
      }],

    "csv": ["startList", function createCSV(results, done) {
      console.log("[info] createCSV");
      if (options.format !== "csv") {
        console.log("[info] skipping csv generation");
        return done();
      }
      var
        ix = 0,
        output = _.map(results.startList, function csvify(a) {
          ix += 1;
          var row;
          if (lookup) {
            row = [a.bib, a.firstName + " " + a.lastName + ", " + a.division + ", " + a.team];
          } else {
            row = [ix, a.bib, a.firstName + " " + a.lastName, a.division, a.team];
          }
          return row;
        });
      if (lookup) {
        output.unshift(["Bib", "Athlete"]);
      } else {
        output.unshift(["Order", "Bib", "Name", "Division", "Team"]);
      }
      console.log("about to writeToString");
      csv.writeToString(output, {headers: true}, done);
    }]

  },
  function wrapup(wrapupErr, results) {
    console.log("[info] wrapup");
    if (wrapupErr) {
      return callback(wrapupErr);
    }
    if (options.format === "array") {
      callback(null, results.startList);
    } else if (options.format === "csv") {
      callback(null, results.csv);
    } else {
      callback(new Error("Unsupported format: '" + options.format + "'"));
    }
  });
};
