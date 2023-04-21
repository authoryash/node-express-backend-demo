const { onlyNumberRegex, timeRegex } = require("../constants/index.constants");
const { keyToName } = require("./string-conversions");

const DataValidatorFunctions = {
  editLessonDataValidator: (data) => {
    for (let key of ["courseId", "lessonId", "creatorId"])
      if (!data[key]) return `${keyToName(key)} is required`;
    for (let key of Object.keys(data)) {
      if (
        ["lessonNumber" /*, "lessonDay" */].includes(key) &&
        !onlyNumberRegex.test(data[key])
      )
        return `${keyToName(key)} should be only number and greater than 0`;
      if (["lessonTitle", "lessonDescription"].includes(key) && !data[key])
        return `${keyToName(key)} is required`;
      if (key === "lessonDuration") return "Can't change duration of old video";
    }
  },

  // addBadgeToCourseDataValidator: (course, body) => {
  //   if (!course) return "Course doesn't exists";
  //   if (course.creatorId.toString() !== body.badgeCreatorId)
  //     return "Course is not created by current user";
  //   if (body.badgeCreatorId !== course.creatorId.toString())
  //     return "Creator of badge is different than course creator";
  //   const badgeExists = course.courseBadgesList.some(
  //     (badge) => body.badgeName === badge.badgeName
  //   );
  //   if (badgeExists) return "Badge with same name already exists";
  // },

  addLessonToCourseBodyDataValidator: (body) => {
    const {
      courseId = "",
      lessonNumber = "",
      lessonTitle = "",
      // lessonDescription = "",
      // lessonPdf = "",
      // lessonDay = "",
      lessonDuration = 0,
      lessonVideo = "",
      lessonPdf = "",
      lessonDescription = "",
    } = body;
    if (!courseId) return `${keyToName("courseId")} is not provided`;
    if (!onlyNumberRegex.test(lessonNumber))
      return `${keyToName(
        "lessonNumber"
      )} should be only number and greater than 0`;
    if (!lessonTitle) return `${keyToName("lessonTitle")} is required`;
    // console.log(lessonPdf, "lesspdf");
    // if (!lessonDescription && !lessonPdf)
    //   return `${keyToName("lessonDescription or pdf")} is required`;
    // if (!onlyNumberRegex.test(lessonDay))
    //   return `${keyToName(
    //     "lessonDay"
    //   )} should be only number and greater than 0`;

    if (lessonVideo !== "null" && !timeRegex.test(lessonDuration))
      return "Invalid time value for duration of lesson";

    if (lessonPdf === "null" && !lessonDescription)
      return "Plese provide lesson pdf or lesson content";
    return "";
  },
};

module.exports = DataValidatorFunctions;
