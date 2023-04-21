const express = require("express"),
  router = express.Router();
const {
  addWellnessCategory,
  addBadgeTrigger,
} = require("../../controllers/AdminController");
const {
  AddBadgeTriggerValidator,
} = require("../../middlewares/index.middleware");

router.post("/add-wellness-categories", addWellnessCategory);
router.post("/add-badge-trigger", AddBadgeTriggerValidator, addBadgeTrigger);

module.exports = router;
