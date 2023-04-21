"use strict";
const express = require("express");
const path = require("path");
const { loggerMiddleware } = require("../src/middlewares/index.middleware");
const { HttpError } = require("../system/helpers/HttpError");
const apiRoutes = require("../system/routes");
const { swaggerUiServe, swaggerUiSetup } = require("./swagger");
const bodyParser = require("body-parser");

module.exports.setRoutes = (app) => {
  /**
   * Application Root Route.
   * Set the Welcome message or send a static html or use a view engine.
   */
  app.get("/", (req, res) => {
    res.redirect("/docs");
  });

  app.use(loggerMiddleware);
  /**
   * API Route.
   * All the API will start with "/api/[MODULE_ROUTE]"
   */
  app.use("/docs", swaggerUiServe, swaggerUiSetup);
  app.use("/api", apiRoutes);
  app.use(bodyParser.urlencoded({ extended: true }));
  /**
   * Serving Static files from uploads directory.
   * Currently Media module is uploading files into this directory.
   */
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
  app.use(
    express.urlencoded({
      extended: true,
    })
  );
  /**
   * If No route matches. Send user a 404 page
   */
  app.use("/*", (req, res) => {
    const error = new Error("Requested path does not exist.");

    error.statusCode = 404;
    res.status(error.statusCode).json(new HttpError(error));
  });
};
