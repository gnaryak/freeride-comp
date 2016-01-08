var
  expect = require("expect.js"),
  createResults = require("../lib/results.js");

describe("results", function () {
  it.only("should work", function (done) {
    this.timeout(10000);
    createResults("dev", 2016, "db", "F11-14", {format: "csv"},
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
    createResults("dev", 2016, "db", "BOARDM11-14", {format: "array"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("results: %j", results);
      expect(results).to.be.an("array");
      done();
    });
  });

});