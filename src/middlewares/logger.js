const loggerMiddleware = async (req, res, next) => {
  let log = {
    method: req.method || "GET",
    query: req.query,
    params: req.params,
    host: req.hostname || "localhost",
    path: req.pathname || req.path || "/",
    port: req.port || "3000",
    headers: req.headers || {},
    body: req.body,
  };
  console.log("--------------------------");
  console.log("Host:", log.host);
  console.log("API:", log.path);
  console.log("Method:", log.method);
  console.log("Query:", log.query);
  console.log("Params:", log.params);
  console.log("Body:", log.body);
  console.log("--------------------------");
  next();
};

module.exports = { loggerMiddleware };
