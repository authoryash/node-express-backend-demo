const {
  onlyNumberRegex,
  timeRegex,
  regexForBucketFileNaming,
  videoMimeTypes,
  editLessonVideoContentField,
  documentType,
} = require("../../constants/index.constants");
const path = require("path");
const {
  keyToName,
  // addLessonToCourseBodyDataValidator,
} = require("../../helpers/index.helper");
const { uid } = require("rand-token");

const checksForAddingLessons = (body, file, cb) => {
  const { fieldname, mimetype } = file;
  const { lessonDescription } = body;

  if (fieldname === "lessonVideo" && !videoMimeTypes.includes(mimetype))
    return cb(
      new Error(
        "Only .mp4, .m4a, .fmp4, webM, .mkv and apple quicktime format allowed for lesson video!"
      )
    );
  if (fieldname === "lessonPdf") {
    if (!lessonDescription && !fieldname)
      return `${keyToName("lessonDescription or pdf")} is required`;
    if (!documentType.includes(mimetype))
      return cb(new Error("Only pdf allowed"));
  }
  // const errorVal =
  //   fieldname === "lessonVideo"
  //     ? addLessonToCourseBodyDataValidator(body)
  //     : addLessonToCourseBodyDataValidator(body, false);
  // if (errorVal) return cb(new Error(errorVal));

  // const errorVal = addLessonToCourseBodyDataValidator(body);
  // if (errorVal) return cb(new Error(errorVal));
  cb(null, true);
};

const pathForCourseLesson = (req, file) => {
  const { originalname, fieldname } = file;
  const { courseId, /* lessonTitle,*/ lessonNumber } = req.body;
  const { _id: userId } = req.query;
  const { lessonId } =
    editLessonVideoContentField === fieldname ? req.body : req.query;
  let pathString = (value) =>
    `courses/${userId}/${courseId}/lessons/${value}/(${lessonNumber})-${lessonId}-${uid(
      16
    )}${path.extname(originalname)}`;
  if (fieldname === "lessonPdf") return pathString(`${keyToName("lessonPdf")}`);
  if (["editLessonVideo", "lessonVideo"].includes(fieldname))
    return pathString(`${keyToName("lessonVideo")}`);
  // return `courses/${userId}/${courseId}/lessons/(${lessonNumber})-${lessonId}-${uid(
  //   16
  // )}${path.extname(originalname)}`;
  // return `courses/${userId}/${courseId}/lessons/(${lessonNumber})-(${lessonTitle})-${lessonId}${path.extname(
  //   originalname
  // )}`;
  // let pathString = (value) =>
  //   `courses/${creatorId}/${courseId}/${value}-${uid(
  //     16
  //   )}-${creatorId}-${courseId}-${Date.now()}${path.extname(
  //     file.originalname
  //   )}`;
};

const checksForEditLessons = (body, file, cb) => {
  const { mimetype = "" } = file;
  const {
    lessonNumber = "",
    lessonTitle = "",
    lessonDescription = "",
    // lessonDay = "",
    lessonDuration = "",
    lessonId = "",
    courseId = "",
  } = body;
  if (!videoMimeTypes.includes(mimetype))
    cb(
      new Error(
        "Only .mp4, .m4a, .fmp4, webM, .mkv and apple quicktime format allowed!"
      )
    );
  else if (!onlyNumberRegex.test(lessonNumber))
    cb(
      new Error(
        `${keyToName("lessonNumber")} should be only number and greater than 0`
      )
    );
  // else if (
  //   Object.prototype.hasOwnProperty.call(body, "lessonDay") &&
  //   !onlyNumberRegex.test(lessonDay)
  // )
  //   cb(
  //     new Error(
  //       `${keyToName("lessonDay")} should be only number and greater than 0`
  //     )
  //   );
  else if (!timeRegex.test(lessonDuration))
    cb(new Error("Invalid time value for course"));
  else if (!lessonTitle)
    cb(new Error(`${keyToName("lessonTitle")} is required`));
  else if (!regexForBucketFileNaming.test(lessonTitle))
    cb(new Error(`${keyToName("lessonTitle")} should not contain / or ~|`));
  else if (
    Object.prototype.hasOwnProperty.call(body, "lessonDescription") &&
    !lessonDescription
  )
    cb(new Error(`${keyToName("lessonDescription")} is required`));
  else if (!lessonDuration)
    cb(new Error(`${keyToName("lessonDuration")} is required`));
  else if (!lessonId) cb(new Error(`${keyToName("lessonId")} is not provided`));
  else if (!courseId) return `${keyToName("courseId")} is not provided`;
  else cb(null, true);
};

module.exports = {
  checksForAddingLessons,
  pathForCourseLesson,
  checksForEditLessons,
};
