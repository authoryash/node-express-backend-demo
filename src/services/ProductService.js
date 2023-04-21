const autoBind = require("auto-bind");
const { Service } = require("../../system/services/Service");
const Products = require("../models/Products");


class ProductService extends Service {
    constructor(model) {
        super(model);
        this.model = model;
        autoBind(this);
    }

    async addNewProductService(data) {
        console.log({ data, model: this.model })
        const result = await this.model.create(data);
        console.log({ result })
    }
}

module.exports = new ProductService(Products);

