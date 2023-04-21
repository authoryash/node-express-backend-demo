const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { PORT } = process.env;

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "demo Fitness App API",
      version: "1.0.0",
      description: "demo fitness APP API collection",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development Server",
      },
    ],
    tags: [
      {
        name: "Authentication", // name of a tag
      },
    ],
    // components: {
    //   schemas: {
    //     // error model
    //     Error: {
    //       type: "object", //data type
    //       properties: {
    //         message: {
    //           type: "string", // data type
    //           description: "Error message", // desc
    //           example: "Not found", // example of an error message
    //         },
    //         internal_code: {
    //           type: "string", // data type
    //           description: "Error internal code", // desc
    //           example: "Invalid parameters", // example of an error internal code
    //         },
    //       },
    //     },
    //   },
    // },
  },
  apis: ["./src/controllers/*.js"],
};

const specs = swaggerJSDoc(options);

const swaggerUiServe = swaggerUi.serve;
const swaggerUiSetup = swaggerUi.setup(specs);
module.exports = { swaggerUiServe, swaggerUiSetup };
