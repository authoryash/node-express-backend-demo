const { upload } = require("../middlewares/index.middleware");
const {
  saveCategoryInDB,
  saveBadgeTriggerInDB,
  checkIfBadgeTriggerAlreadyExists,
} = require("../services/AdminService");
const { isEmpty } = require("lodash");
const { CatchErrorHandler } = require("../utils/common-error-handlers");
const { Success } = require("../utils/httpHandlers");

class AdminController {
  addWellnessCategory(req, res) {
    try {
      upload.single("categoryImageURL")(req, res, async (err) => {
        try {
          if (err) throw err.message;
          const { categoryName = "" } = req.body;
          if (!req.file?.location) throw "File not uploaded on cloud";
          const saveCategory = await saveCategoryInDB(
            categoryName,
            req.file?.location
          );
          if (!isEmpty(saveCategory)) throw "Category is saved successfully";
        } catch (error) {
          return CatchErrorHandler(res, error, "Wellness category addition");
        }
      });
    } catch (error) {
      return CatchErrorHandler(res, error, "Wellness category addition");
    }
  }

  async addBadgeTrigger(req, res) {
    try {
      const { result, data } = await checkIfBadgeTriggerAlreadyExists(req.body);
      if (!result) throw data;
      if (!isEmpty(data)) throw "Trigger with name or condition already exists";
      const { result: triggerResult, data: triggerData } =
        await saveBadgeTriggerInDB(req.body);
      if (!triggerResult) throw triggerData;
      if (!result) throw data;
      return Success(res, 200, "Badge trigger added successfully");
    } catch (error) {
      return CatchErrorHandler(res, error, "Badge trigger addition");
    }
  }
}

module.exports = new AdminController();
