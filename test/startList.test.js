var
  expect = require("expect.js"),
  startList = require("../lib/startList.js");

describe("startList", function () {
  it("should work", function (done) {
    this.timeout(10000);
    startList("dev", 2016, "db", "day2", {lookup: true, rerandomize: false},
    function handleStartList(err, response) {
      if (err) {
        throw err;
      }
      console.log("response: %j", response);
      expect(response).to.be.a("string");
      done();
    });
  });

  it("should support cutoffs", function (done) {
    this.timeout(10000);
    startList("dev", 2016, "db", "finals", {lookup: false, rerandomize: false},
    function handleStartList(err, response) {
      if (err) {
        throw err;
      }
      console.log("response: %j", response);
      expect(response).to.be.a("string");
      done();
    });
  });

  it("should support the 'array' format", function (done) {
    this.timeout(10000);
    startList("dev", 2016, "db", "day3", {format: "array"},
    function handleStartList(err, response) {
      if (err) {
        throw err;
      }
      console.log("response: %j", response);
      expect(response).to.be.an("array");
      done();
    });
  });

});