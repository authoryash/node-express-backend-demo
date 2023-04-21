const { Service } = require("../../system/services/Service");
const {
  WellnessCategoriesSchema,
  BadgeTriggersSchema,
} = require("../models/index.models");

class AdminService extends Service {
  checkCategoryExists(categoryName) {
    return WellnessCategoriesSchema.findOne({ categoryName });
  }

  saveCategoryInDB(categoryName, categoryImageUrl) {
    return WellnessCategoriesSchema.create({ categoryName, categoryImageUrl });
  }

  async saveBadgeTriggerInDB(body) {
    try {
      const data = await BadgeTriggersSchema.create(body);
      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async checkIfBadgeTriggerAlreadyExists({ triggerName, triggerCondition }) {
    try {
      const data = await BadgeTriggersSchema.findOne({
        $or: [{ triggerName }, { triggerCondition }],
      });
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
}

module.exports = new AdminService();
