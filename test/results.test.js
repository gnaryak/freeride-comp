var
  _ = require("lodash"),
  expect = require("expect.js"),
  createResults = require("../lib/results.js");

describe("results", function () {
  it("should work", function (done) {
    this.timeout(10000);
    createResults("tjfs", 2016, "kirkwood", {division: "F11-14", format: "csv"},
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
    createResults("tjfs", 2016, "kirkwood", {division: "BOARD11-14", format: "array"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("results: %j", results);
      expect(results).to.be.an("array");
      _.forEach(results, function validateResult(r) {
        expect(r.score).to.be.above(0);
        expect(r.scores).to.not.eql({});
      });
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
      // console.log("results: %j", results);
      expect(results).to.be.a("string");
      done();
    });
  });

  it("should work with unisex divisions", function (done) {
    this.timeout(10000);
    createResults("tjfs", 2016, "sb", {division: "BOARD11-14", format: "csv"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      // console.log("results: %j", results);
      expect(results).to.be.a("string");
      done();
    });
  });

  it("should support a ties option", function (done) {
    this.timeout(10000);
    createResults("tjfs", 2016, "sb",
    {division: "F15-18", ties: "leave", format: "csv"},
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