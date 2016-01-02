var
  express = require("express"),
  debug = require("debug")("tjfs:server"),
  startList = require("./startList.js");

/**
 * This is a fallback function that is called when no other endpoint handles a
 * request. Sets X-StatusCode to 404.
 * @param req An express Request object
 * @param res An express Response object
 */
function handle404(req, res) {
  res.status(404).json({error: "unavailable tjfs resource"});
}

function handleStartList(req, res) {
  debug("[info] path=%s", req.path);
  var rerandomize = (req.query.rerandomize === "true");
  startList(
    req.params.seriesId, req.params.seriesYear, req.params.compId, req.params.dateString, rerandomize,
  function startListDone(err, startList) {
    if (err) {
      return res.status(500).json({error: err.message, detail: err});
    }
    res.type("text/csv");
    res.send(startList);
  });
}

/**
 * Start the server.
 * @return The app that was started.
 */
module.exports = function start() {
  var
    app = express();

  app.get("/startList/series/:seriesId/year/:seriesYear/comp/:compId/date/:dateString", handleStartList);
  // Call fallback endpoint when none of the endpoints above are hit:
  app.all("*", handle404);

  app.listen(4321);
  debug("[info] Listening on port 4321");

  return app;
};