/* eslint-disable no-unused-vars */
const autoBind = require("auto-bind");
const { uploadProduct } = require("../middlewares/index.middleware");
const ProductService = require("../services/ProductService");
const { CatchErrorHandler } = require("../utils/common-error-handlers");
const { Success } = require("../utils/httpHandlers");

class ProductController {
    constructor(service) {
        this.service = service;
        autoBind(this);
    }

    async getProductList(req, res) {
        console.log("inside controller");
    }

    // async addNewProduct(req, res) {
    //     console.log({ body: req.body })
    //     await ProductService.addNewProductService(req.body);
    //     return Success(res, 200, "Add New Product in progress");
    // }

    async addNewProduct(req, res) {
        try {
            uploadProduct.single("productPic")(req, res, async (err) => {
                try {
                    if (err) throw err.message;
                    console.log("inside", req.file)
                } catch (error) {
                    return CatchErrorHandler(res, error, "Updating mentor profile builder");
                }
            })
        } catch (error) {
            return CatchErrorHandler(res, error, "Updating mentor profile builder");
        }
    }
}

module.exports = new ProductController(ProductService);