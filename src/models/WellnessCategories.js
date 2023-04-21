const { Schema, model } = require("mongoose");

const WellnessCategoriesSchema = new Schema(
  {
    categoryName: {
      type: String,
      required: true,
      unique: true,
    },
    categoryImageUrl: {
      type: String,
    },
    priorityNumber: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = model("WellnessCategories", WellnessCategoriesSchema);
