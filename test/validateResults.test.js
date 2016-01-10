var
  expect = require("expect.js"),
  _ = require("lodash"),
  validateResults = require("../lib/validateResults.js");

describe("validateResults", function () {
  it("should work", function (done) {
    this.timeout(20000);
    validateResults("tjfs", 2016, "sb", "Saturday",
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