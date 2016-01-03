var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:startList"),
  util = require("./util.js"),
  createResults = require("./results.js");

/**
 * Generate random sorting #'s for all the athletes.
 */
function randomize(compdivisions, competitors, rerandomize, key, done) {
  debug("[info] randomize");

  async.waterfall([

    function getPrior(cb) {
      if (rerandomize) {
        cb(null, {});
      } else {
        // Use the previously generated random numbers
        util.retrieveFromS3(key,
        function handleRandom(randomErr, randomData) {
          if (randomErr) {
            // There was an error retrieving the prior random numbers.
            // They probably don't exist.
            debug("[warn] no prior random numbers");
            cb(null, {});
          }
          cb(null, randomData);
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
      _.each(randomNums, function mapify(r) {
        rMap[r] = true;
      });
      _.each(competitors, function oneRandom(c) {
        if (!randomNums[c.bib]) {
          // Avoid dups
          // Use an optimistic approach. If we get a dup, just try again.
          var r = Math.floor(Math.random() * (99999 - 1)) + 1;
          while (rMap[r]) {
            debug("[info] avoiding duplicate random # %s", r);
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
  var allForDiv = _.filter(results.compdivisions,
  function filterByDiv(otherCd) {
    return (otherCd.comp === compDivision.comp && otherCd.division === compDivision.division);
  });
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
    debug("[debug] %s %s (%s) has a sort value of %s",
      a.firstName, a.lastName, a.division, sortValue);
    return sortValue;
  });
  return athletes;
}

/**
 * Sort the competitors in a division for a comp based on their results.
 * They will be sorted in reverse order
 */
function sortCompDivisionByResults(seriesName, seriesYear, compDivision, cb) {
  createResults(seriesName, seriesYear, compDivision.comp, compDivision.division, "array",
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
    // debug("[debug] prior to sorting for %s: %j", compDivision.division, athletes);
    athletes.reverse();
    // debug("[debug] after sorting: %j", athletes);
    cb(null, athletes);
  });
}

/**
 * Generate a start list for the given comp and run group.
 */
module.exports = function startList(
  seriesName, seriesYear, comp, runGroup, lookup, rerandomize, callback) {

  var
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

    "random": ["competitors", "compdivisions",
    function handleRandoms(done, results) {
      var
        sorts = _.uniq(_.pluck(_.filter(results.compdivisions,
        function forCompAndRunGroup(cd) {
          return cd.comp === comp && cd.runGroup === runGroup;
        }), "sort")),
        usesRandomSort = _.some(sorts, function hasRandom(sort) {
          return (sort.indexOf("random") > -1);
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
    function assignCompetitorDivisions(done, results) {
      util.assignCompetitorDivisions(
        results.competitors, results.competitions, results.divisions, comp);
      done(null, results.competitors);
    }],

    "startList": ["compdivisions", "competitorDivisions", "random",
    function createStartList(done, results) {
      debug("[info] createStartList");
      var dayDivisions = _.filter(results.compdivisions,
      function forCompAndRunGroup(cd) {
        return cd.comp === comp && cd.runGroup === runGroup;
      });
      dayDivisions = _.sortBy(dayDivisions, "orderInRunGroup");
      debug("[debug] divisions: %j", dayDivisions);
      async.map(dayDivisions, function mapDivision(cd, cdCb) {
        if (cd.sort.indexOf("random") > -1) {
          return cdCb(null, randomlySortCompDivision(cd, results, comp));
        } else if (cd.sort.indexOf("cutoff") === 0) {
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

    "csv": ["startList",
    function createCSV(done, results) {
      debug("[info] createCSV");
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
      debug("about to writeToString");
      csv.writeToString(output, {headers: true}, done);
    }]

  },
  function wrapup(wrapupErr, results) {
    debug("[info] wrapup");
    if (wrapupErr) {
      return callback(wrapupErr);
    }
    callback(null, results.csv);
  });
};