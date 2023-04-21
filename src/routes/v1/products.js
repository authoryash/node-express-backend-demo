const express = require("express"), router = express.Router();
const ProductController = require("../../controllers/ProductController");
const { AddProductId } = require("../../middlewares/data-mutating.middlewares");

router.get("/get-product-list", ProductController.getProductList);
// router.post('/add-new-product', ProductController.addNewProduct);
router.post("/add-new-product", AddProductId, ProductController.addNewProduct);

module.exports = router;