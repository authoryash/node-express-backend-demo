const { UserService } = require("./../services/UserService");
const { User } = require("./../models/User");
const MentorUser = require("../models/MentorUser");
const { isEmpty } = require("lodash");
const autoBind = require("auto-bind");
const { Exception, Success } = require("../utils/httpHandlers");
const {
  upload,
  TokenValidatorHelperFunction,
} = require("../middlewares/index.middleware");
const {
  WellnessCategoriesSchema,
  FollowersListSchema,
  CoursesSchema,
  BadgeTriggersSchema,
  UserCourseProgressSchema,
} = require("../models/index.models");
const userService = new UserService(User, MentorUser);
const PostDetailService = require("./../services/PostDetailservice");
const { Types } = require("mongoose");
const { CatchErrorHandler } = require("../utils/common-error-handlers");
const CourseService = require("../services/CourseService");
const {
  onlyNumberRegex,
  updateProfileFields,
  userRoles,
  mentorPerDiscoverQuery,
} = require("../constants/index.constants");
const { keyToName } = require("../helpers/string-conversions");
const { getSampleCourseList } = require("../services/CourseService");
const {
  getSampleMentorsListController,
} = require("./ControllerHelperFunctions");
const BadgeService = require("../services/BadgeService");
const { NotificationService } = require("../services/NotificationService");

class UserController {
  constructor(service) {
    this.service = service;
    this.courseService = CourseService;
    this.notificationService = new NotificationService();
    autoBind(this);
  }

  async updateProfile(req, res) {
    try {
      upload.single("profilePic")(req, res, async (err) => {
        try {
          if (err) return Exception(res, 400, err.message);
          if (!req.file) await TokenValidatorHelperFunction(req, res);
          const {
            _id = "",
            role = "",
            wellnessRole = "",
            name = "",
          } = req.body;
          if (!name) throw "Name can not be empty";
          // if (!/^[^0-9]+$/.test(name))
          //   throw "Name can only contains non numeric values";
          if (role !== "mentor" && wellnessRole?.length)
            throw "Only mentor can set wellness role";
          const data = {};
          updateProfileFields.forEach((item) => {
            if (Object.prototype.hasOwnProperty.call(req.body, item))
              data[item] = req.body[item];
          });
          if (req?.file?.location) data["profilePic"] = req.file.location;
          if (req.body?.profilePic === "null") data["profilePic"] = "";
          const updatedProfile = await this.service.updateProfile(
            _id,
            role,
            data
          );
          if (!updatedProfile) throw "User profile update failed";
          return Success(res, 200, "User profile updated successfully", {
            updatedProfile,
          });
        } catch (error) {
          if (typeof error === "string") return Exception(res, 400, error);
          return Exception(
            res,
            400,
            "Unexpected Error! User Profile Update failed",
            error
          );
        }
      });
    } catch (error) {
      return Exception(
        res,
        400,
        "Unexpected Error! User Profile Update failed",
        error
      );
    }
  }

  async getMentorRecommendation(req, res) {
    try {
      let { categoryIds = [], pageNumber = "" } = req.query;
      const { _id = "" } = req.body;
      categoryIds = categoryIds.split(",");
      let categoriesList = await WellnessCategoriesSchema.find(
        {},
        { categoryName: 0, _id: 1 }
      );
      categoriesList = categoriesList.map((item) => item._id.toString());
      const invalidCategory = categoryIds.some(
        (item) => !categoriesList.includes(item)
      );
      if (invalidCategory)
        return Exception(res, 422, "Invalid category value has been passed");
      categoryIds = categoryIds.map((item) => {
        return Types.ObjectId(item);
      });
      let mentorList = await this.service.getRecommendedMentorList({
        _id,
        categories: categoryIds,
        pageNumber,
      });
      return Success(
        res,
        200,
        !mentorList?.length
          ? "No mentor recommendation available"
          : "Mentor recommendation list fetched successfully",
        mentorList
      );
    } catch (error) {
      return Exception(
        res,
        400,
        "Unexpected Error! get mentor recommendation failed",
        error
      );
    }
  }

  async getProfileBuilderData(req, res) {
    try {
      const { _id = "", role = "" } = req.body;
      if (role !== "mentor")
        return Exception(res, 400, "Only mentor can access this feature");
      const getDataForProfileBuilder = await this.service.getProfileBuilderData(
        _id
      );
      if (!getDataForProfileBuilder)
        return Exception(res, 400, "User doesn't exists");
      return Success(
        res,
        200,
        "Profile builder data fetched successfully",
        getDataForProfileBuilder
      );
    } catch (error) {
      return Exception(
        res,
        400,
        "Unexpected Error! in get profile builder data api",
        error
      );
    }
  }

  async setProfileBuilderData(req, res) {
    const { _id = "", tags = [], wellnessCategories = [] } = req.body;
    try {
      const profileBuilderUpdate = await this.service.setProfileBuilderData(
        _id,
        tags,
        wellnessCategories
      );
      if (!profileBuilderUpdate) throw "Updating mentor profile builder";
      return Success(res, 200, "Profile builder updated successfully");
    } catch (error) {
      return CatchErrorHandler(res, error, "Updating mentor profile builder");
    }
  }

  async getProfileData(req, res) {
    const { _id = "", role = "" } = req.body;
    try {
      if (!userRoles.includes(role)) throw "Invalid user role";
      const { result, data } = await this.service.getProfileData(_id, role);
      if (!result) throw data;
      if (isEmpty(data)) throw "User doesn't exists";
      return Success(res, 200, "Profile fetching is successfull", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Fetching profile details");
    }
  }

  async followUser(req, res) {
    const {
      _id: followerId = "",
      influencerId = "",
      influencerRole = "",
      role = "",
    } = req.body;
    try {
      const { result, data } = await this.service.createFollower(
        followerId,
        influencerId,
        influencerRole,
        role
      );
      if (result && !isEmpty(data) && data.currentFollowStatus) {
        const { result: followedUserResult, data: followedUserData } =
          await this.service.getProfileData(influencerId, influencerRole);
        const { result: followingUserResult, data: followingUserData } =
          await this.service.getProfileData(followerId, role);
        if (!followedUserResult) throw followedUserData;
        if (isEmpty(followedUserData)) throw "Followed User doesn't exists";
        if (!followingUserResult) throw followingUserData;
        if (isEmpty(followingUserData)) throw "Followed User doesn't exists";
        let registrationToken = followedUserData.FCMToken;
        if (registrationToken) {
          let message = {
            notification: {
              title: "demo",
              body: `${followingUserData.name} started following you`,
            },
          };
          const notificationData = await this.service.sendNotification({
            registrationToken,
            message,
          });
          if (notificationData.results) {
            let storingData = {};
            let setData = [];
            storingData["recieverId"] = followedUserData._id;
            storingData["recieverRole"] = followedUserData.role;
            storingData["recieverUsername"] = followedUserData.userName;
            storingData["recieverPic"] = followedUserData.profilePic;
            storingData["createdDate"] = new Date().toLocaleDateString();
            setData.push({
              senderId: followingUserData._id,
              senderRole: followingUserData.role,
              senderUsername: followingUserData.userName,
              senderPic: followingUserData.profilePic,
              description: message.notification.body,
              notificationType: "following",
              notificationSent:
                notificationData.successCount === 1 ? true : false,
              createdAt: new Date(),
            });
            const setNotificationData =
              await this.notificationService.setNotification(
                storingData,
                setData
              );
            console.log(
              "🚀 ~ file: UserController.js:230 ~ UserController ~ followUser ~ notificationData",
              setNotificationData
            );
          }
        }
        return Success(res, 200, "User has been followed successfully");
      }
      if (result && !isEmpty(data) && !data.currentFollowStatus)
        return Success(res, 200, "User has been unfollowed successfully");
      if (!result) throw data;
      return Success(res, 200, "User is following now");
    } catch (error) {
      return CatchErrorHandler(res, error, "Following user");
    }
  }

  async getWellnessCategories(req, res) {
    try {
      const { result, data } = await this.service.getWellnessCategories();
      if (!result) throw data;
      return Success(
        res,
        200,
        "Wellness categories fetching successfull",
        data
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Fetching wellness categories");
    }
  }

  async setWellnessCategories(req, res) {
    try {
      const { _id = "", categories = [], role = "" } = req.body;
      const { result, data } = await this.service.updateWellnessCategories(
        _id,
        categories,
        role
      );
      if (!result) throw data;
      return Success(res, 200, "Wellness categories updated successfully");
    } catch (error) {
      return CatchErrorHandler(
        res,
        error,
        "Updating wellness categories for user"
      );
    }
  }

  async getpost(req, res) {
    try {
      const user_id = req.query.postId ? req.query.postId : req.body._id;
      const callByUser = req.query.callbyuser;
      const getdata = await PostDetailService.getPostDetails(
        user_id,
        callByUser
      );
      return Success(res, 200, "Data fetched", getdata);
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async getCourseDetailByUserId(req, res) {
    try {
      const user_id = req.query.user_id;
      const getdata = await CourseService.getCourseList(user_id);
      return Success(res, 200, "Data fetched", getdata);
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async getCourseInfo(req, res) {
    try {
      const { _id: userId } = req.body;
      const { courseId } = req.query;
      let { result, data } = await CourseService.getCourseInfoInterface({
        userId,
        courseId,
      });
      if (!result) throw data;
      data.forEach((element, index) => {
        if (element.videoduration !== "") {
          let time = this.secondsToHMS(element.videoduration);
          data[index].lessonTotallength = time;
        }
      });
      let { courseSignup, resultc } = await userService.getEnrolledCourses({
        courseId,
        userId,
      });
      if (!resultc) throw courseSignup;
      data[0].courseSignup = !isEmpty(courseSignup);
      let ratings = await CourseService.courseRatings({ courseId });
      let courseProgress = await UserCourseProgressSchema.findOne({
        courseId,
        userId,
      });
      if (courseProgress) data[0].isCompleted = courseProgress.isCompleted;
      let totalcount = 0;
      if (ratings.result) {
        ratings.data.forEach((element) => {
          return (totalcount += element.count);
        });
        ratings.data.map((element) => {
          element.percentage = Number(
            ((element.count / totalcount) * 100).toFixed(1)
          );
        });
      }
      let avgRating = 0;
      if (ratings.result) {
        ratings.data.forEach((element) => {
          avgRating += element.rating;
        });
        data[0].avgRating = Number(
          (avgRating / ratings.data.length).toFixed(1)
        );
        data[0].ratingscount = ratings.data;
      } else {
        data[0].avgRating = avgRating;
      }
      return Success(res, 200, "data fetched", data);
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async likePost(req, res) {
    try {
      const postId = req.body.postId;
      const { _id = "", role = "" } = req.body;
      const { result: UserResult, data: UserData } =
        await userService.getProfileData(_id, role);
      if (!UserResult) throw UserData;
      let user = UserData;
      const { data } = await PostDetailService.getPostDetails(postId);
      let userLiked = data[0]?.userLiked ?? [];
      const currentIndex = userLiked.findIndex((element) => element === _id);
      let msg = "";
      if (currentIndex === -1) {
        msg = "liked";
        userLiked.push(_id);
      } else {
        msg = "disliked";
        userLiked.splice(currentIndex, 1);
      }
      const createLikeData = await PostDetailService.postLiked(
        postId,
        userLiked
      );
      if (!createLikeData) throw `Post ${msg.replace(/ed$/, "ing")} failed`;
      if (!isEmpty(createLikeData.postdata))
        createLikeData.postdata._doc.liked = msg === "liked";
      if (msg === "liked") {
        const { result: postResult, data: postData } =
          await PostDetailService.getPostDetails(postId);
        if (!postResult) throw "no post ";
        let registrationToken = postData[0].creatorDetails[0].FCMToken;
        if (registrationToken) {
          let message = {
            notification: {
              title: "demo",
              body: `${user.name} liked your post`,
            },
          };
          const notificationData = await this.service.sendNotification({
            registrationToken,
            message,
          });
          if (notificationData.results) {
            let storingData = {};
            let setData = [];
            storingData["recieverId"] = postData[0].creatorDetails[0]._id;
            storingData["recieverRole"] = postData[0].creatorDetails[0].role;
            storingData["recieverUsername"] =
              postData[0].creatorDetails[0].userName;
            storingData["recieverPic"] =
              postData[0].creatorDetails[0].profilePic;
            storingData["createdDate"] = new Date().toLocaleDateString();
            setData.push({
              senderId: user._id,
              senderRole: user.role,
              senderUsername: user.userName,
              senderPic: user.profilePic,
              description: message.notification.body,
              notificationType: "PostLike",
              notificationSent:
                notificationData.successCount === 1 ? true : false,
              createdAt: new Date(),
            });
            const setNotificationData =
              await this.notificationService.setNotification(
                storingData,
                setData
              );
            console.log(
              "🚀 ~ file: UserController.js:230 ~ UserController ~ followUser ~ notificationData",
              setNotificationData
            );
          }
        }
      }
      return Success(res, 200, `Post ${msg} successfully`, {
        createLikeData,
      });
    } catch (error) {
      let errorMsg;
      if (typeof error === "string") errorMsg = error;
      return Exception(
        res,
        400,
        errorMsg ?? "Unexpected Error in changing post like status",
        errorMsg ? {} : error
      );
    }
  }

  secondsToHMS = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor((seconds % 3600) % 60);

    const hDisplay = h > 0 ? (h < 10 ? "0" : "") + h + "hr" : "";
    const mDisplay = m > 0 ? (m < 10 ? "0" : "") + m + "min" : "";

    const sDisplay = s > 0 ? (s < 10 ? "0" : "") + s + "sec" : "";
    return hDisplay + mDisplay + sDisplay;
  };

  async savePost(req, res) {
    const postId = req.body.postId;
    const { _id = "", role = "" } = req.body;
    const { result, data } = await userService.getProfileData(_id, role);
    if (!result) throw data;
    let user = data;

    if (isEmpty(data)) throw "User doesn't exists";
    let postSaved = data.postSaved ? data.postSaved : [];

    if (postSaved) {
      const alreadysaved = postSaved.some((element) => {
        return element == postId;
      });

      if (alreadysaved) {
        var filtered = postSaved.filter(function (value) {
          return value != postId;
        });
        postSaved = filtered;
        let { result, data } = await userService.savePost(_id, postSaved, role);
        if (!result) return CatchErrorHandler(res, data, "Post unsaved");
        return Success(res, 200, "Post unsaved successfully", {
          postId,
          saved: false,
        });
      } else {
        postSaved.push(postId);
      }
    } else {
      postSaved.push(postId);
    }
    {
      const { result, data } = await userService.savePost(_id, postSaved, role);
      if (!result) return CatchErrorHandler(res, data, "Post Saved");
      const { result: postResult, data: postData } =
        await PostDetailService.getPostDetails(postId);
      if (!postResult) throw "no post ";
      let registrationToken = postData[0].creatorDetails[0].FCMToken;
      if (registrationToken) {
        let message = {
          notification: {
            title: "demo",
            body: `${user.name} saved your post`,
          },
        };
        const notificationData = await this.service.sendNotification({
          registrationToken,
          message,
        });
        if (notificationData.results) {
          let storingData = {};
          let setData = [];
          storingData["recieverId"] = postData[0].creatorDetails[0]._id;
          storingData["recieverRole"] = postData[0].creatorDetails[0].role;
          storingData["recieverUsername"] =
            postData[0].creatorDetails[0].userName;
          storingData["recieverPic"] = postData[0].creatorDetails[0].profilePic;
          storingData["createdDate"] = new Date().toLocaleDateString();
          setData.push({
            senderId: user._id,
            senderRole: user.role,
            senderUsername: user.userName,
            senderPic: user.profilePic,
            description: message.notification.body,
            notificationType: "PostSave",
            notificationSent:
              notificationData.successCount === 1 ? true : false,
            createdAt: new Date(),
          });
          const setNotificationData =
            await this.notificationService.setNotification(
              storingData,
              setData
            );
          console.log(
            "🚀 ~ file: UserController.js:230 ~ UserController ~ followUser ~ notificationData",
            setNotificationData
          );
        }
      }
      return Success(res, 200, "Post saved successfully", {
        postId,
        saved: true,
      });
    }
  }

  async createpost(req, res) {
    let lessonKey = "";
    try {
      upload.single("imageUrl")(req, res, async (err) => {
        try {
          const { file, body } = req;
          const { description = "" } = body;
          if (err) throw err.message;
          if (!file && !description)
            throw "Neither image nor content is provided in post";
          const data = body;
          if (data.communityTags)
            data.communityTags = data.communityTags.split(",");
          if (data.usersMentions)
            data.usersMentions = data.usersMentions.split(",");
          data["userId"] = req.query._id;
          if (file) {
            lessonKey = req.file.key;
            data["imageUrl"] = req.file.location;
          }
          delete data["_id"];
          const { result, data: resultData } =
            await PostDetailService.createPostDetails(data);
          if (!result) throw resultData;
          return Success(res, 200, "Post created successfully", {
            resultData,
          });
        } catch (error) {
          return CatchErrorHandler(res, error, "Post Creation", lessonKey);
        }
      });
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async getMemberPerspective(req, res) {
    try {
      //profile
      let { role, userId } = req.query;
      let { _id = "" } = req.body;
      const callByUser = "true";
      userId = userId ? userId : _id;
      role = role ? role : req.body.role;

      const { result: profileResult, data: profileData } =
        await this.service.getProfileData(userId, role);
      if (!profileResult) throw profileData;
      if (isEmpty(profileData)) throw "User doesn't exists";
      const { result: loggedUserResult, data: loggedUserdetails } =
        await this.service.getProfileData(_id, req.body.role);
      if (!loggedUserResult) throw loggedUserdetails;
      if (isEmpty(loggedUserdetails)) throw "User doesn't exist";
      const responsePostDetails = await PostDetailService.getPostDetails(
        userId,
        callByUser
      );
      responsePostDetails.data.forEach((element, index) => {
        responsePostDetails.data[index].saved =
          loggedUserdetails?.postSaved.includes(element._id.toString());
      });
      responsePostDetails.data.forEach((item) => {
        if (item.userLiked.includes(_id)) item.liked = true;
        else item.liked = false;
      });
      let courseData = [];
      if (role === "mentor")
        courseData = await CourseService.getCourseList(userId, 0, {
          courseCategories: 1,
          courseTitle: 1,
          thumbnailImageURL: 1,
        });
      const isFollowing = await FollowersListSchema.findOne({
        followerId: _id,
        influencerId: userId,
        currentFollowStatus: true,
      });
      const Data = {
        profileDetail: { ...profileData._doc, isFollowing: !!isFollowing },
        postDetail: responsePostDetails,
        courseDetail: courseData,
      };
      // if (role === "member") delete Data.courseDetail;
      return Success(res, 200, "data fetched successfully", Data);

      //post
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async getPostsForPerspective(req, res) {
    try {
      const { role, userId, pageNumber = 0 } = req.query;
      const { _id = "" } = req.body;
      const callByUser = "true";
      const { result: profileResult, data: profileData } =
        await this.service.getProfileData(userId, role);
      if (!profileResult) throw profileData;
      if (isEmpty(profileData)) throw "User doesn't exists";
      const { result: loggedUserResult, data: loggedUserdetails } =
        await this.service.getProfileData(_id, req.body.role);
      if (!loggedUserResult) throw loggedUserdetails;
      if (isEmpty(loggedUserdetails)) throw "User doesn't exist";
      const responsePostDetails = await PostDetailService.getPostDetails(
        userId,
        callByUser,
        pageNumber
      );
      responsePostDetails.data.forEach((element, index) => {
        responsePostDetails.data[index].saved =
          loggedUserdetails?.postSaved.includes(element._id.toString());
      });
      responsePostDetails.data.forEach((item) => {
        if (item.userLiked.includes(_id)) item.liked = true;
        else item.liked = false;
      });
      return Success(
        res,
        200,
        "data fetched successfully",
        responsePostDetails.data
      );
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async getCoursePerspective(req, res) {
    try {
      let { role, userId, pageNumber = 0 } = req.query;
      let { _id = "" } = req.body;
      userId = userId ? userId : _id;
      role = role ? role : req.body.role;
      let courseData;
      if (role === "mentor") {
        courseData = await CourseService.CourseService.getCourseList(
          userId,
          pageNumber,
          {
            courseCategories: 1,
            courseTitle: 1,
            thumbnailImageURL: 1,
          }
        );
      }
      return Success(res, 200, "data fetched successfully", courseData.data);
    } catch (error) {
      return Exception(res, 400, "Unexpected Error", error);
    }
  }

  async searchMentor(req, res) {
    try {
      const value = req.query.queryValue;
      const { pageNumber = 0 } = req.query;

      const { _id } = req.body;
      const { result, getdata } = await userService.searchMentor({
        value,
        _id,
        pageNumber,
      });
      if (!result) throw getdata;
      return Success(res, 200, "data fetched successfully", getdata);
    } catch (error) {
      return Exception(res, 400, "users cant be searced", error);
    }
  }

  async searchUser(req, res) {
    try {
      const value = req.query.queryValue;
      const { pageNumber = 0 } = req.query;
      const { _id } = req.body;
      const { result, getdata } = await userService.searchUser({
        value,
        _id,
        pageNumber,
      });
      if (!result) throw getdata;
      return Success(res, 200, "data fetched successfully", getdata);
    } catch (error) {
      return Exception(res, 400, "users cant be searced", error);
    }
  }

  async searchCourse(req, res) {
    try {
      const value = req.query.queryValue;

      const { pageNumber = 0 } = req.query;
      // const { _id } = req.body;
      const { result, getdata } = await this.courseService.searchCourse(
        value,
        pageNumber,
        {
          courseCategories: 1,
          courseTitle: 1,
          thumbnailImageURL: 1,
        }
      );
      if (!result) throw getdata;
      return Success(res, 200, "data fetched successfully", getdata);
    } catch (error) {
      return Exception(res, 400, "course searching failed", error);
    }
  }

  async getCourseDetails(req, res) {
    try {
      const { courseId } = req.query;
      const course = await this.courseService.getCourseDetails(courseId);
      if (!course) throw "Course doesn't exists";
      return Success(res, 200, "Course details fetched successfully", course);
    } catch (error) {
      return CatchErrorHandler(res, error, "Fetching course details");
    }
  }

  async getMemberDashBoardData(req, res) {
    try {
      const { _id, role } = req.body;
      if (role !== "member") throw "Only member can access this api";
      const { result, data } = await this.service.getMemberDashBoardDataService(
        _id
      );
      if (!result) throw data;
      return Success(
        res,
        200,
        "Member dashboard data fetched successfully",
        data
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Fetching member dashboard data");
    }
  }

  async getPostList(req, res) {
    try {
      const { userId = null } = req.query;
      const { _id } = req.body;
      const { pageNumber = 0 } = req.query;
      if (!onlyNumberRegex.test(pageNumber))
        throw `${keyToName(
          "pageNumber"
        )} should be only number and greater than 0`;
      const queryData = {
        _id,
        userId,
        pageNumber,
      };
      const { result, data } = await this.service.getPostListService(queryData);
      if (!result) throw data;
      return Success(res, 200, "Posts list fetched successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Post list fetching");
    }
  }

  async getMemberExplorePageData(req, res) {
    try {
      const { _id, role } = req.body;
      // if (role !== "member") throw "Only member can access this functionality";
      const { result, data } = await this.service.getExploreDataService({
        _id,
        role,
      });
      if (!result) throw data;
      return Success(
        res,
        200,
        "Member explore page data fetched successfully",
        data
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Member explore page data fetching");
    }
  }

  async getDiscoverPost(req, res) {
    try {
      let { _id, alreadyFetchedPostsId } = req.body;
      alreadyFetchedPostsId = alreadyFetchedPostsId.map((item) =>
        Types.ObjectId(item)
      );
      let mentorList = await FollowersListSchema.find(
        {
          followerId: _id,
          influencerRole: "mentor",
          currentFollowStatus: true,
        },
        "influencerId -_id"
      );
      mentorList = mentorList.map((item) => item.influencerId);
      const { result, data } = await PostDetailService.getSamplePostList({
        _id,
        mentorList,
        alreadyFetchedPostsId,
      });
      if (!result) throw data;
      return Success(res, 200, "Discovered post successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Discovering postð");
    }
  }

  async getDiscoverCourse(req, res) {
    try {
      let { alreadyFetchedCoursesId, _id } = req.body;
      alreadyFetchedCoursesId = alreadyFetchedCoursesId.map((item) =>
        Types.ObjectId(item)
      );
      const { result, data } = await getSampleCourseList({
        _id,
        alreadyFetchedCoursesId,
      });
      if (!result) throw data;
      return Success(res, 200, "Discovered courses successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Discovering courses");
    }
  }

  async getDiscoverMentor(req, res) {
    try {
      const { result, data } = await getSampleMentorsListController(
        req,
        mentorPerDiscoverQuery
      );
      if (!result) throw data;
      return Success(res, 200, "Discovered mentors successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Discovering mentor");
    }
  }

  async getFeedPosts(req, res) {
    try {
      const { result, data } = await this.service.getFeedPostsService(req.body);
      const { result: loggedUserResult, data: loggedUserdetails } =
        await this.service.getProfileData(req.body._id, req.body.role);
      if (!loggedUserResult) throw loggedUserdetails;
      data.forEach((element, index) => {
        data[index].saved = loggedUserdetails?.postSaved.includes(
          element._id.toString()
        );
      });
      if (!result) throw data;
      return Success(res, 200, "Data for feed successfully fetched", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Feed post fetching");
    }
  }

  async getMemberProfilePage(req, res) {
    try {
      const { userId = null } = req.query;
      const { _id } = req.body;
      const profilePromise = this.service.getProfileData(
        userId ?? _id,
        "member"
      );
      const postPromise = this.service.getPostListService({
        _id,
        userId,
        pageNumber: 0,
      });
      const [{ result, data }, { result: postResult, data: postData }] =
        await Promise.all([profilePromise, postPromise]);
      if (!result) throw data;
      if (isEmpty(data)) throw "User doesn't exists as member";
      if (!postResult) throw postData;
      return Success(
        res,
        200,
        "Get member profile page data fetched successfully",
        { userData: data, postData }
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Getting member profile page data");
    }
  }

  async getCourseListByWellnessCategories(req, res) {
    try {
      const { wellnessCategories, pageNumber = "" } = req.query;
      const { _id } = req.body;
      const { result, data } =
        await this.courseService.getCoursesListByWellnessCategories(
          pageNumber,
          _id,
          wellnessCategories
        );
      data.forEach((element, index) => {
        let weightageRating = 0;
        let totalCount = 0;
        element.ratings.forEach(({ _id, count }) => {
          if (_id) {
            weightageRating += _id * count;
            totalCount += count;
          }
        });
        data[index].avgRating =
          weightageRating && totalCount
            ? Number((weightageRating / totalCount).toFixed(1))
            : 0;
      });
      if (!result) throw data;
      if (isEmpty(data)) return Success(res, 200, "No data to display", data);
      return Success(res, 200, "fetched successfully", data);
    } catch (error) {
      return Exception(res, 400, "something went wrong", error);
    }
  }

  async findUsers(req, res) {
    try {
      const { userName = "", alreadyFetchedUsersIdObjects = [] } = req.body;
      const { result, data } = await this.service.findUsersService({
        userName,
        alreadyFetchedUsersIdObjects,
      });
      if (!result) throw data;
      return Success(res, 200, "Searched users successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "User searching");
    }
  }

  async getUserCoursesTitles(req, res) {
    try {
      const { role, _id } = req.body;
      const { result, data } = await CourseService.getUserCoursesTitlesServices(
        {
          role,
          _id,
        }
      );
      if (!result) throw data;
      return Success(res, 200, "User course list fetched successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "User course list fetching");
    }
  }

  async createCourseProgress(req, res) {
    try {
      const { _id, courseId, role } = req.body;

      const { result, data } = await this.courseService.createCourseProgress({
        _id,
        courseId,
      });
      if (!result) throw data;
      const course = await CoursesSchema.findById(courseId);

      const { data: feedBackUserData } = await this.service.getProfileData(
        _id,
        role
      );
      const { data: creatorData } = await this.service.getProfileData(
        course.creatorId,
        "mentor"
      );
      if (creatorData.FCMToken) {
        let message = {
          notification: {
            title: "demo",
            body: `${feedBackUserData.name} enrolled in  your course ${course.courseTitle}`,
          },
        };
        let registrationToken = creatorData.FCMToken;
        const notificationData = await this.service.sendNotification({
          registrationToken,
          message,
        });

        if (notificationData.results) {
          let storingData = {};
          let setData = [];
          storingData["recieverId"] = creatorData._id;
          storingData["recieverRole"] = creatorData.role;
          storingData["recieverUsername"] = creatorData.userName;
          storingData["recieverPic"] = creatorData.profilePic;
          storingData["createdDate"] = new Date().toLocaleDateString();
          setData.push({
            senderId: feedBackUserData._id,
            senderRole: feedBackUserData.role,
            senderUsername: feedBackUserData.userName,
            senderPic: feedBackUserData.profilePic,
            description: message.notification.body,
            notificationType: "courseEnrolled",
            notificationSent:
              notificationData.successCount === 1 ? true : false,
            createdAt: new Date(),
          });
          const setNotificationData =
            await this.notificationService.setNotification(
              storingData,
              setData
            );
          console.log(
            "🚀 ~ file: UserController.js:230 ~ UserController ~ followUser ~ notificationData",
            setNotificationData
          );
        }
      }
      return Success(res, 200, "progress of course created succesfully", data);
    } catch (error) {
      return Exception(res, 400, "something went wrong", error);
    }
  }
  async getMycourseList(req, res) {
    try {
      const { _id } = req.body;
      const { result, data } = await this.courseService.myCourses({ _id });
      if (!result) throw data;
      let ongoingCourses = data.filter((element) => {
        return element.isCompleted === false;
      });
      let completedcourses = data.filter((element) => {
        return element.isCompleted === true;
      });

      let badgeFinal = [];
      let { result: EarnedbadgeResult, data: EarnedbadgeData } =
        await userService.getEarnedBadges({
          _id,
        });
      if (!EarnedbadgeResult) throw EarnedbadgeData;
      if (EarnedbadgeResult && isEmpty(EarnedbadgeData)) {
        badgeFinal = [];
      }
      EarnedbadgeData = EarnedbadgeData.map((d) => {
        d.badges = d.badges.reduce((a, c) => a.concat(c), []);
        return d;
      });
      let { badgeResult, badgeData } = await userService.getEarnedBadgesDetails(
        {
          badgeArray: EarnedbadgeData[0].badges,
        }
      );
      badgeData.forEach((item) => {
        if (item.courseBadgeList) {
          for (let index = 0; index < item.courseBadgeList.length; index++) {
            const element = item.courseBadgeList[index];
            badgeFinal.push(element);
          }
        }
      });
      if (!badgeResult) throw badgeData;

      return Success(res, 200, "My courses fetched", {
        ongoingCourses: ongoingCourses,
        completedcourses: completedcourses,
        earnedBadgData: badgeFinal,
      });
    } catch (error) {
      return Exception(res, 400, "something went wrong", error);
    }
  }

  async createLessonCompletion(req, res) {
    try {
      const { _id, courseId, lessonId, role } = req.body;
      if (role !== "member") throw "Only member can use this functionality";
      const progressPromise = this.courseService.updateProgressLessonDetail({
        _id,
        courseId,
        lessonId,
      });
      const coursePromise = CoursesSchema.findById(courseId);
      const badgeTriggerPromise = BadgeTriggersSchema.find({});
      const [
        { result: progressResult, data: progressData },
        course,
        badgeTriggers,
      ] = await Promise.all([
        progressPromise,
        coursePromise,
        badgeTriggerPromise,
      ]);
      if (!progressResult) throw progressData;
      let courseBadgeTriggers = course.courseBadgesList
        .map((badge) => {
          const item = badgeTriggers.find(
            (triggerItem) =>
              badge.badgeTriggerId.equals(triggerItem._id) &&
              !progressData.value.earnedBadges.some((earnedBadge) =>
                earnedBadge.badgeId.equals(badge._id)
              )
          );
          if (item)
            return {
              ...badge._doc,
              triggerCondition: item.triggerCondition,
              weightage: item.weightage,
              triggerName: item.triggerName,
            };
        })
        .filter((item) => item);
      const courseCompletionPercentage =
        (progressData.value.completedLessons.length * 100) /
        course.courseLessonList.length;
      const newEarnedBadges = [];
      const weightageArray = [];
      for (let { _id, triggerCondition, weightage } of courseBadgeTriggers) {
        const [triggerBase, value] = triggerCondition.split("-");
        if (triggerBase === "progress" && value !== "100")
          if (Number(value) <= courseCompletionPercentage) {
            newEarnedBadges.push({
              badgeId: _id,
              earnedOn: new Date(),
            });
            weightageArray.push(weightage);
          }
      }
      const totalWeightage = weightageArray.reduce(
        (acc, weightage) => acc + weightage,
        0
      );
      if (newEarnedBadges.length)
        this.courseService.updateCompleteCourseList({
          _id,
          courseId,
          newEarnedBadges,
        });

      if (totalWeightage)
        this.service.updateProgressBarService({
          _id,
          totalWeightage,
          badgeCount: newEarnedBadges.length,
        });
      return Success(
        res,
        200,
        "Course lesson completed successfully",
        progressData
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Lesson completion failed");
    }
  }

  async createCourseCompletion(req, res) {
    try {
      const { _id, courseId, review, ratings, courseQuestionAnswers, role } =
        req.body;
      const progressPromise = this.courseService.updateCourseCompleteDetail({
        _id,
        courseId,
        review,
        ratings,
        courseQuestionAnswers,
      });
      const coursePromise = CoursesSchema.findById(courseId);

      const badgeTriggerPromise = BadgeTriggersSchema.find({});
      const [
        { result: progressResult, data: progressData },
        course,
        badgeTriggers,
      ] = await Promise.all([
        progressPromise,
        coursePromise,
        badgeTriggerPromise,
      ]);
      if (!progressResult) throw progressData;
      const { data: feedBackUserData } = await this.service.getProfileData(
        _id,
        role
      );
      const { data: creatorData } = await this.service.getProfileData(
        course.creatorId,
        "mentor"
      );
      if (creatorData.FCMToken) {
        let message = {
          notification: {
            title: "demo",
            body: `${feedBackUserData.name} rated your course ${course.courseTitle}`,
          },
        };
        let registrationToken = creatorData.FCMToken;
        const notificationData = await this.service.sendNotification({
          registrationToken,
          message,
        });

        if (notificationData.results) {
          let storingData = {};
          let setData = [];
          storingData["recieverId"] = creatorData._id;
          storingData["recieverRole"] = creatorData.role;
          storingData["recieverUsername"] = creatorData.userName;
          storingData["recieverPic"] = creatorData.profilePic;
          storingData["createdDate"] = new Date().toLocaleDateString();
          setData.push({
            senderId: feedBackUserData._id,
            senderRole: feedBackUserData.role,
            senderUsername: feedBackUserData.userName,
            senderPic: feedBackUserData.profilePic,
            description: message.notification.body,
            notificationType: "courseFeedback",
            notificationSent:
              notificationData.successCount === 1 ? true : false,
            createdAt: new Date(),
          });
          const setNotificationData =
            await this.notificationService.setNotification(
              storingData,
              setData
            );
          console.log(
            "🚀 ~ file: UserController.js:230 ~ UserController ~ followUser ~ notificationData",
            setNotificationData
          );
        }
      }

      let courseBadgeTriggers = course.courseBadgesList
        .map((badge) => {
          const item = badgeTriggers.find(
            (triggerItem) =>
              badge.badgeTriggerId.equals(triggerItem._id) &&
              !progressData.value.earnedBadges.some((earnedBadge) =>
                earnedBadge.badgeId.equals(badge._id)
              )
          );
          if (item)
            return {
              ...badge._doc,
              triggerCondition: item.triggerCondition,
              weightage: item.weightage,
              triggerName: item.triggerName,
            };
        })
        .filter((item) => item);
      const newEarnedBadges = [];
      const weightageArray = [];
      for (let { _id, triggerCondition, weightage } of courseBadgeTriggers) {
        const [triggerBase, value] = triggerCondition.split("-");
        if (triggerBase === "progress" && value === "100") {
          newEarnedBadges.push({
            badgeId: _id,
            earnedOn: new Date(),
          });
          weightageArray.push(weightage);
        }
      }
      const totalWeightage = weightageArray.reduce(
        (acc, weightage) => acc + weightage,
        0
      );
      if (newEarnedBadges.length)
        this.courseService.updateCompleteCourseList({
          _id,
          courseId,
          newEarnedBadges,
        });
      if (totalWeightage)
        this.service.updateProgressBarService({
          _id,
          totalWeightage,
          badgeCount: newEarnedBadges.length,
        });
      return Success(res, 200, " course completed succesfully", progressData);
    } catch (error) {
      return Exception(res, 400, "something went wrong", error);
    }
  }

  async getCourseProgress(req, res) {
    try {
      const { _id } = req.body;
      const { courseId } = req.query;
      const { data } = await this.courseService.getCourseProgress({
        courseId,
        _id,
      });
      return Success(res, 200, "progress fetched successfully", data);
    } catch (error) {
      return Exception(res, 400, "something went wrong", error);
    }
  }

  async getUserBadgesTitles(req, res) {
    try {
      const { role, _id } = req.body;
      const { courseId } = req.query;
      const { result, data } = await BadgeService.getUserBadgesTitles({
        _id,
        role,
        courseId,
      });
      if (!result) throw data;
      return Success(res, 200, "Course badge list fetched successfully", data);
    } catch (error) {
      return CatchErrorHandler(res, error, "Course badge list fetching");
    }
  }

  async getuserCourseLessonDetail(req, res) {
    try {
      const { _id } = req.body;
      const { courseId } = req.query;
      const { result, data } = await CourseService.courseLessonlist({
        // _id,
        courseId,
      });

      if (!result) throw data;
      const {
        result: progressResult,
        data: [progressData],
      } = await this.courseService.courseProgressLessonlist({
        _id,
        courseId,
      });

      if (!progressResult) throw progressData;
      if (progressData == undefined) {
        for (let courseLesson of data) {
          courseLesson.completed = false;
        }
      }
      if (progressData != undefined) {
        for (let courseLesson of data) {
          courseLesson.completed = false;
          for (let progressLesson of progressData.completedLessons) {
            if (
              courseLesson._id.toString() === progressLesson.lessonId.toString()
            ) {
              courseLesson.completed = true;
              break;
            }
          }
        }
      }

      data.forEach((element, index) => {
        let time = this.secondsToHMS(element.time);
        data[index].lessonTotallength = time;
        delete data[index].time;
      });

      return Success(res, 200, "course lesson list fetched", data);
    } catch (error) {
      return Exception(res, 400, "course lesson list fetching fail", error);
    }
  }
  async getLessonInfo(req, res) {
    try {
      const { courseId, lessonId } = req.query;
      const { data, result } = await CourseService.lessonInfo({
        courseId,
        lessonId,
      });
      if (!result) throw data;
      return Success(res, 200, "course lesson list fetched", data);
    } catch (error) {
      return Exception(res, 400, "course lesson list fetching fail", error);
    }
  }
  async deletePost(req, res) {
    try {
      const { postId, _id } = req.body;
      const { result, data } = await PostDetailService.deletePost({
        postId,
        _id,
      });
      if (!result) throw data;
      return Success(res, 200, "post delted successfully", data);
    } catch (error) {
      return Exception(res, 400, "post deletion failed", error);
    }
  }
  async editPostWithoutImage(req, res) {
    try {
      const { body } = req;
      const { _id, postId } = body;
      const editData = body;
      const { result: loggedUserResult, data: loggedUserdetails } =
        await this.service.getProfileData(_id, req.body.role);
      if (!loggedUserResult) throw loggedUserdetails;
      if (isEmpty(loggedUserdetails)) throw "User doesn't exist";
      if (editData.description && editData.description == "")
        throw "post description cant be set empty";
      if (editData.communityTags || editData.communityTags === "")
        editData.communityTags =
          editData?.communityTags === ""
            ? []
            : editData?.communityTags.split(",");
      if (editData.usersMentions || editData.usersMentions === "")
        editData.usersMentions =
          editData?.usersMentions === ""
            ? []
            : editData?.usersMentions.split(",");
      delete editData["_id"];
      delete editData["postId"];
      delete editData["phoneNumber"];
      delete editData["email"];
      delete editData["role"];
      const { result, data: editedData } = await PostDetailService.editPost({
        _id,
        postId,
        editData,
      });
      if (!result) throw editedData;
      if (result) {
        const responsePostDetails = await PostDetailService.getPostDetails(
          postId
        );
        responsePostDetails.data.forEach((element, index) => {
          responsePostDetails.data[index].saved =
            loggedUserdetails?.postSaved.includes(element._id.toString());
        });
        responsePostDetails.data.forEach((item) => {
          if (item.userLiked.includes(_id)) item.liked = true;
          else item.liked = false;
        });
        return Success(
          res,
          200,
          "post Edited Successfully",
          ...responsePostDetails.data
        );
      }
    } catch (error) {
      return Exception(res, 400, "post edit failed", error);
    }
  }
  async getBadgeTriggerslist(req, res) {
    try {
      const { result, data } = await BadgeService.getBadgeTriggers();
      if (!result) throw data;
      return Success(res, 200, "badgetriggers fetched successfully", data);
    } catch (error) {
      return Exception(res, 400, "badgetriggers fetching failed", error);
    }
  }
  async getSavedPost(req, res) {
    try {
      const { body, query } = req;
      const { _id, role } = body;
      const { pageNumber = 0 } = query;
      const { result: loggedUserResult, data: loggedUserdetails } =
        await this.service.getProfileData(_id, role);
      if (!loggedUserResult) throw loggedUserdetails;
      if (isEmpty(loggedUserdetails)) throw "User doesn't exist";
      if (isEmpty(loggedUserdetails.postSaved)) throw "no post saved";
      const responsePostDetails = await PostDetailService.getSavedPostDetails({
        savedPosts: loggedUserdetails.postSaved,
        pageNumber,
      });

      responsePostDetails.data.forEach((element, index) => {
        responsePostDetails.data[index].saved =
          loggedUserdetails?.postSaved.includes(element._id.toString());
      });

      responsePostDetails.data.forEach((item) => {
        if (item.userLiked.includes(_id)) item.liked = true;
        else item.liked = false;
      });
      let savedPostsOfMember = responsePostDetails.data.filter((item) => {
        return item.creatorDetails[0].role === "member";
      });
      let savedPostsOfMentor = responsePostDetails.data.filter((item) => {
        return item.creatorDetails[0].role === "mentor";
      });
      const Data = {
        memberPosts: !isEmpty(savedPostsOfMember) ? savedPostsOfMember : [],
        mentorPosts: !isEmpty(savedPostsOfMentor) ? savedPostsOfMentor : [],
      };
      return Success(res, 200, "post saved fetched Successfully", Data);
    } catch (error) {
      return Exception(res, 400, "saved post fetching failed", error);
    }
  }
  async getEarnedBadges(req, res) {
    try {
      const { _id } = req.body;
      let { result, data } = await userService.getEarnedBadges({
        _id,
      });
      if (!result) throw data;
      if (isEmpty(data)) throw "no badges to display";
      data = data.map((d) => {
        d.badges = d.badges.reduce((a, c) => a.concat(c), []);
        return d;
      });
      let { badgeResult, badgeData } = await userService.getEarnedBadgesDetails(
        {
          badgeArray: data[0].badges,
        }
      );
      let badgeFinal = [];
      badgeData.forEach((item) => {
        if (item.courseBadgeList) {
          for (let index = 0; index < item.courseBadgeList.length; index++) {
            const element = item.courseBadgeList[index];
            badgeFinal.push(element);
          }
        }
      });
      if (!badgeResult) throw badgeData;

      // return res.status(200).json([badgeData[0], badgeData[1]]);
      return Success(res, 200, "badges earned", badgeFinal);
    } catch (error) {
      return Exception(res, 400, "cant find badges", error);
    }
  }
  async getNotifications(req, res) {
    try {
      const { _id } = req.body;
      let { result, data } = await this.notificationService.getNotifications(
        _id
      );
      if (!result) throw data;
      Success(res, 200, "data found", data);
    } catch (error) {
      Exception(res, 400, "error", error);
    }
  }
}

module.exports = new UserController(userService);
