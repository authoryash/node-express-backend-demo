const { WellnessCategoriesSchema } = require("../models/index.models");

const DataMutatingFunctions = {
  setWellnessCategoriesInSequence: async (courseList) => {
    const wellnessCategories = await WellnessCategoriesSchema.find({});
    courseList.forEach((course) => {
      let categoryNames = course.courseCategories.map((item) => {
        const { categoryName, priorityNumber } = wellnessCategories.find(
          (catitem) => catitem._id.toString() === item
        );
        return { categoryName, priorityNumber };
      });
      categoryNames.sort((a, b) => a.priorityNumber - b.priorityNumber);
      categoryNames = categoryNames.map((item) => item.categoryName);
      course.courseCategories = categoryNames;
    });
  },
};

module.exports = DataMutatingFunctions;
