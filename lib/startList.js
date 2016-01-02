var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:startList"),
  AWS = require("aws-sdk"),
  S3_BUCKET = "tjfs";

function retrieveFromS3(key, cb) {
  var
    s3 = new AWS.S3(),
    s3params = {
      Bucket: S3_BUCKET,
      Key: key
    };
  AWS.config.update({region: "us-east-1"});
  debug("[info] retrieving %j", s3params);
  s3.getObject(s3params, function handleS3File(err, data) {
    if (err) {
      debug("[error] Error getting %s:/%s from s3: %s. %j",
        S3_BUCKET, key, err.message, err);
      return cb(err, null);
    }
    cb(null, JSON.parse(data.Body.toString()));
  });
}

function writeToS3(key, content, cb) {
  var
    s3 = new AWS.S3(),
    s3params = {
      Bucket: S3_BUCKET,
      Key: key,
      // ACL: "public-read",
      Body: content
    };
  AWS.config.update({region: "us-east-1"});
  debug("[info] writing %s bytes to %s/%s",
    s3params.Body.length, s3params.Bucket, s3params.Key);
  s3.putObject(s3params, function handleS3Write(err, data) {
    if (err) {
      debug("[error] writing %s:/%s from s3: %s. %j",
        S3_BUCKET, key, err.message, err);
      return cb(err);
    }
    debug("[info] wrote %s: %j", key, data);
    cb();
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
      retrieveFromS3(keyPrefix + "divisions.json", done);
    },

    "compdivisions": function getCompDivisions(done) {
      retrieveFromS3(keyPrefix + "compdivisions.json", done);
    },

    "competitions": function getCompetitions(done) {
      retrieveFromS3(keyPrefix + "competitions.json", done);
    },

    "competitors": function getCompetitors(done) {
      retrieveFromS3(keyPrefix + "competitors.json", done);
    },

    "random": ["competitors",
    function randomize(done, results) {
      debug("[info] randomize");
      async.waterfall([

        function getPrior(cb) {
          if (rerandomize) {
            cb(null, {});
          } else {
            // Use the previously generated random numbers
            retrieveFromS3(keyPrefix + comp + "/random.json",
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
          _.each(results.competitors, function oneRandom(c) {
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
          writeToS3(keyPrefix + comp + "/random.json", JSON.stringify(randoms),
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

    }],

    "competitorDivisions": ["divisions", "competitors", "competitions",
    function assignCompetitorDivisions(done, results) {
      debug("[info] assignCompetitorDivisions");
      // Calculate the competition age of each competitor,
      // then look up their division.
      var
        asOf = new Date(results.competitions[comp].startDate.substr(0,4) + "-01-01");
      debug("[info] competition age as of %s", asOf);
      _.each(results.competitors,
      function assignAgeAndDivision(c) {
        var ageDifMs = asOf.getTime() - (new Date(c.dob)).getTime(),
          ageDate = new Date(ageDifMs); // miliseconds from epoch
        c.competitionAge = Math.abs(ageDate.getUTCFullYear() - 1970);
        debug("[debug] %s -> %s years old", c.dob, c.competitionAge);
        var dMatch = _.find(results.divisions, function findD(d) {
          return (
            d.gender === c.gender &&
            d.discipline === c.discipline &&
            d.minAge <= c.competitionAge &&
            d.maxAge >= c.competitionAge);
        });
        if (dMatch) {
          c.division = dMatch.id;
          debug("[debug] assigned division %s to %s %s",
            c.division, c.firstName, c.lastName);
        } else {
          debug("[warn] no division for %j", c);
        }
      });
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
      var athleteDivisions = _.map(dayDivisions, function gatherAthletes(dd) {
        // Sort the athletes within that division.
        // Determine the sequence for this division in this comp, so we know
        // which athletes to include.
        var allForDiv = _.filter(results.compdivisions,
        function filterByDiv(otherCd) {
          return (otherCd.comp === dd.comp && otherCd.division === dd.division);
        });
        allForDiv = _.sortBy(allForDiv, "orderForDivision");
        var
          ddIx = 0,
          curDD = allForDiv[ddIx];
        while (curDD && (curDD.orderForDivision  !== dd.orderForDivision)) {
          ddIx += 1;
          curDD = allForDiv[ddIx];
        }
        ddIx += 1;

        var athletes = _.filter(results.competitorDivisions,
        function filterAthletes(a) {
          return (a.division === dd.division && a.bib && a[comp + "-" + ddIx]);
        });
        // Sort the athletes
        athletes = _.sortBy(athletes, function sortAthletes(a) {
          var sortValue = results.random[a.bib];
          if (dd.sort === "reverserandom") {
            sortValue = -sortValue;
          }
          debug("[debug] %s %s (%s) has a sort value of %s",
            a.firstName, a.lastName, a.division, sortValue);
          return sortValue;
        });
        return athletes;
      });
      // Flatten the nested arrays into a single array
      athleteDivisions = _.flatten(athleteDivisions);
      done(null, athleteDivisions);
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