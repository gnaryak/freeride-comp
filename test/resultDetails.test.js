var
  expect = require("expect.js"),
  _ = require("lodash"),
  createResultDetails = require("../lib/resultDetails.js");

describe("resultDetails", function () {
  it("should work", function (done) {
    this.timeout(20000);
    createResultDetails("tjfs", 2016, "sb", "Friday", {},
    function handleCreateResultDetails(err, results) {
      if (err) {
        throw err;
      }
      console.log("Results: %j", results);
      // expect(response).to.be.a("string");
      done();
    });
  });

});