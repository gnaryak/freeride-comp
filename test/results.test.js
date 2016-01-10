var
  _ = require("lodash"),
  expect = require("expect.js"),
  createResults = require("../lib/results.js");

describe("results", function () {
  it("should work", function (done) {
    this.timeout(10000);
    createResults("tjfs", 2016, "sb", {division: "M11-14", format: "csv"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("results: %j", results);
      expect(results).to.be.a("string");
      done();
    });
  });

  it("should respond with an array", function (done) {
    this.timeout(10000);
    createResults("dev", 2016, "db", {division: "BOARDM11-14", format: "array"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("results: %j", results);
      expect(results).to.be.an("array");
      done();
    });
  });

  it("should provide results for all divisions", function (done) {
    this.timeout(10000);
    createResults("dev", 2016, "db", {format: "array"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      // console.log("results: %j", results);
      expect(results).to.be.an("array");
      var
        priorScore = 9999999,
        priorDivision = "ZZZZZZ";
      _.each(results, function validateAthlete(a) {
        if (a.division !== priorDivision) {
          console.log("Division: %s", a.division);
          priorDivision = a.division;
          priorScore = 9999999;
        }
        expect(a.score <= priorScore).to.be(true);
      });
      done();
    });
  });

  it("should generate results using IFSA divisions", function (done) {
    this.timeout(10000);
    createResults("tjfs", 2016, "sb",
    {format: "csv", divisionType: "ifsa", content: "ifsa"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("results: %j", results);
      expect(results).to.be.a("string");
      done();
    });
  });

});