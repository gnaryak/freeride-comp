var
  expect = require("expect.js"),
  _ = require("lodash"),
  validateResults = require("../lib/validateResults.js");

describe("validateResults", function () {
  it("should work", function (done) {
    this.timeout(20000);
    validateResults("dev", 2016, "db", "day2",
    function handleStartList(err, errors) {
      if (err) {
        throw err;
      }
      console.log("Errors:");
      _.each(errors, function (e) {
        console.log(e.message);
      });
      // expect(response).to.be.a("string");
      done();
    });
  });

});