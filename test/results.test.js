var
  expect = require("expect.js"),
  createResults = require("../lib/results.js");

describe("results", function () {
  it("should work", function (done) {
    this.timeout(10000);
    createResults("tjfs", 2016, "sb", "M11-14",
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