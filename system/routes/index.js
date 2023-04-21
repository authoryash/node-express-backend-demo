"use strict";
const express = require("express");
const router = express.Router();
const pluralize = require("pluralize");
const path = require("path");

pluralize.addUncountableRule("media");
pluralize.addUncountableRule("auth");

const fs = require("fs");
const { HttpError } = require("../helpers/HttpError");
const packageJson = require("../../package.json"),
  routesPath = path.resolve(`${__dirname}/../../src/routes`),
  PATHS = fs.readdirSync(routesPath),
  moduleMapper = [];

console.log("✔ Mapping routes");
PATHS.forEach((module) => {
  let versionRoutesPath = `${routesPath}/${module}`;
  let ROUTEPATHS = fs.readdirSync(versionRoutesPath);
  ROUTEPATHS.forEach((route) => {
    if (route !== "index.js") {
      const name = route.split(".")[0];
      // eslint-disable-next-line global-require
      router.use(
        `/${module}/${pluralize.plural(name)}`,
        require(path.resolve(versionRoutesPath, route))
      );
      moduleMapper.push({
        Module: name,
        Route: `/${module}/${pluralize.plural(name)}`,
      });
    }
  });
});

console.table(moduleMapper);

router.get("/", (req, res) => {
  res.json({
    status: true,
    message: `Welcome to ${packageJson.name} V ${packageJson.version}`,
  });
});

router.use("*", (req, res, next) => {
  // 404 handler
  const error = new Error("Resource not found");

  error.statusCode = 404;
  next(error);
});

router.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error(req.method, req.url, err.statusCode, err.message);
  }
  const error = new HttpError(err);

  res.status(error.statusCode);
  res.json(error);
  next();
});

module.exports = router;
