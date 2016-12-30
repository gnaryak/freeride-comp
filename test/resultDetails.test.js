"use strict";

const
  // expect = require("expect.js"),
  createResultDetails = require("../lib/resultDetails.js");

describe("resultDetails", function () {

  it("should work", function (done) {
    this.timeout(20000);
    createResultDetails("tjfs", 2016, "alpine", "Sunday", {},
    function handleCreateResultDetails(err, results) {
      if (err) {
        throw err;
      }
      console.log("Results: %j", results);
      // expect(response).to.be.a("string");
      done();
    });
  });

  it("should support scalars", function (done) {
    this.timeout(20000);
    createResultDetails("alpinenational", 2016, "alpine", "Q2", {scalars: {control: 2}},
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
