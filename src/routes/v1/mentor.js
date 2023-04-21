const MentorController = require("../../controllers/MentorController");
const {
  TokenValidator,
  AddCourseId,
  AddLessonDataValidator,
  AddUserDetailsFromAuthToken,
  DeleteLessonMiddlewares,
  AddBadgeToCourseValidator,
  EditCourseBadgeValidator,
  AddQuestionToCourseValidator,
  AddBadgeId,
  UserCourseRateDataValidator,
  SendCourseForApprovalValidator,
  GetLessonDetailsDataValidator,
  DeleteCourseBadgeValidator,
} = require("../../middlewares/index.middleware");

const express = require("express"),
  router = express.Router();

router.post(
  "/course-builder",
  TokenValidator,
  AddCourseId,
  MentorController.registerCourse
);
router.post("/add-lesson", AddLessonDataValidator, MentorController.addLesson);
router.get(
  "/get-lesson-details",
  TokenValidator,
  GetLessonDetailsDataValidator,
  MentorController.getLessonDetails
);
router.patch(
  "/edit-lesson",
  AddUserDetailsFromAuthToken,
  MentorController.editLesson
);
router.delete(
  "/delete-lesson",
  AddUserDetailsFromAuthToken,
  DeleteLessonMiddlewares,
  MentorController.deleteLesson
);
router.post(
  "/add-badge-to-course",
  // AddUserDetailsFromAuthToken,
  // AddBadgeToCourseValidator,
  // AddBadgeId,
  TokenValidator,
  AddBadgeToCourseValidator,
  AddBadgeId,
  MentorController.addBadgeToCourse
);
router.put(
  "/edit-course-badge",
  TokenValidator,
  EditCourseBadgeValidator,
  MentorController.editCourseBadge
);
router.delete(
  "/delete-course-badge",
  TokenValidator,
  DeleteCourseBadgeValidator,
  MentorController.deleteCourseBadge
);
router.post(
  "/add-questions",
  TokenValidator,
  AddQuestionToCourseValidator,
  MentorController.addQuestionsToCourse
);
router.patch(
  "/user-course-rate-permission",
  TokenValidator,
  UserCourseRateDataValidator,
  MentorController.userCourseRatePermission
);
router.post(
  "/send-course-for-approval",
  TokenValidator,
  SendCourseForApprovalValidator,
  MentorController.sendCourseForApproval
);
// router.get("/course-progress", MentorController.getCouseProgress);

module.exports = router;
