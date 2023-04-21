"use strict";
const UserController = require("../../controllers/UserController");
const {
  TokenValidator,
  RecommendationValidator,
  FollowUserValidator,
  AddUserDetailsFromAuthToken,
  GetCourseDetailsDataValidator,
  DiscoverAPIsValidator,
  FeedPostValidator,
  SearchUserValidator,
  GetCourseProgressDataValidator,
} = require("../../middlewares/index.middleware");
const express = require("express"),
  router = express.Router();

router.patch("/update-profile", UserController.updateProfile);
router.get(
  "/get-mentor-recommendation",
  RecommendationValidator,
  function (req, res, next) {
    if (req.headers?.authorization) TokenValidator(req, res, next);
    else next();
  },
  UserController.getMentorRecommendation
);
router.get(
  "/get-profile-builder-data",
  TokenValidator,
  UserController.getProfileBuilderData
);
router.patch(
  "/set-profile-builder-data",
  TokenValidator,
  UserController.setProfileBuilderData
);
router.get("/get-profile-data", TokenValidator, UserController.getProfileData);
router.post(
  "/follow-user",
  function (req, res, next) {
    if (req.headers?.authorization) TokenValidator(req, res, next);
    else next();
  },
  FollowUserValidator,
  UserController.followUser
);
router.get("/get-wellness-categories", UserController.getWellnessCategories);
router.post(
  "/set-wellness-categories",
  function (req, res, next) {
    if (req.headers?.authorization) TokenValidator(req, res, next);
    else next();
  },
  UserController.setWellnessCategories
);
router.get(
  "/get-course-details",
  TokenValidator,
  GetCourseDetailsDataValidator,
  UserController.getCourseDetails
);
router.get("/get-post-details", TokenValidator, UserController.getpost);
router.get("/get-post-list", TokenValidator, UserController.getPostList);
router.post(
  "/create-post-details",
  AddUserDetailsFromAuthToken,
  UserController.createpost
);
router.post("/post-like", TokenValidator, UserController.likePost);
router.post("/post-save", TokenValidator, UserController.savePost);
router.get(
  "/get-course-detail",
  TokenValidator,
  UserController.getCourseDetailByUserId
);
router.get(
  "/get-user-all-details",
  TokenValidator,
  UserController.getMemberPerspective
);
router.get(
  "/get-posts-perspective",
  TokenValidator,
  UserController.getPostsForPerspective
);
router.get(
  "/get-course-perspective",
  TokenValidator,
  UserController.getCoursePerspective
);
router.get("/search-mentor", TokenValidator, UserController.searchMentor);
router.get("/search-user", TokenValidator, UserController.searchUser);
router.get("/search-course", TokenValidator, UserController.searchCourse);
router.get(
  "/member-main-dashboard-data",
  TokenValidator,
  UserController.getMemberDashBoardData
);
router.get(
  "/member-explore-page-data",
  TokenValidator,
  UserController.getMemberExplorePageData
);
router.post(
  "/get-discover-post",
  TokenValidator,
  DiscoverAPIsValidator("alreadyFetchedPostsId", "member"),
  UserController.getDiscoverPost
);
router.post(
  "/get-discover-course",
  TokenValidator,
  DiscoverAPIsValidator("alreadyFetchedCoursesId", "member"),
  UserController.getDiscoverCourse
);
router.post(
  "/get-discover-mentor",
  TokenValidator,
  DiscoverAPIsValidator("alreadyFetchedMentorsId", "member"),
  UserController.getDiscoverMentor
);
router.post(
  "/get-feed-posts",
  TokenValidator,
  FeedPostValidator("alreadyFetchedPostsId"),
  UserController.getFeedPosts
);
router.get(
  "/member-profile-page",
  TokenValidator,
  UserController.getMemberProfilePage
);
router.get(
  "/get-course-by-wellnesscategory",
  TokenValidator,
  UserController.getCourseListByWellnessCategories
);
router.post(
  "/find-users",
  TokenValidator,
  SearchUserValidator,
  UserController.findUsers
);
router.get(
  "/get-user-courses-titles",
  TokenValidator,
  UserController.getUserCoursesTitles
);
router.get(
  "/get-user-badges-titles",
  TokenValidator,
  UserController.getUserBadgesTitles
);
router.post(
  "/create-course-progress",
  TokenValidator,
  GetCourseDetailsDataValidator,
  UserController.createCourseProgress
);
router.post(
  "/lesson-complete",
  TokenValidator,
  GetCourseProgressDataValidator,
  UserController.createLessonCompletion
);
router.post(
  "/course-complete",
  TokenValidator,
  GetCourseDetailsDataValidator,
  UserController.createCourseCompletion
);

router.get("/course-info", TokenValidator, UserController.getCourseInfo);
router.get("/get-lesson-info", TokenValidator, UserController.getLessonInfo);
router.get(
  "/course-lesson-list",
  TokenValidator,
  UserController.getuserCourseLessonDetail
);
router.get(
  "/get-user-course-progress",
  TokenValidator,
  UserController.getCourseProgress
);
router.get("/get-my-courses", TokenValidator, UserController.getMycourseList);
router.delete("/delete-post", TokenValidator, UserController.deletePost);
router.put("/edit-post", TokenValidator, UserController.editPostWithoutImage);
router.get("/get-triggers", UserController.getBadgeTriggerslist);
router.get("/get-saved-post", TokenValidator, UserController.getSavedPost);
router.get("/get-my-badges", TokenValidator, UserController.getEarnedBadges);
router.get(
  "/get-my-notifications",
  TokenValidator,
  UserController.getNotifications
);
module.exports = router;
