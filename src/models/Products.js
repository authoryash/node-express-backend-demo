const { Schema, model } = require("mongoose");

const ProductSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },
    productDesc: {
        type: String,
        required: true,
    },
    productPrice: {
        type: Number,
        required: true,
    },
});

module.exports = model("Products", ProductSchema);
