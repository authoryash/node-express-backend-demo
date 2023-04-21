const { uid } = require("rand-token");
const {
  imageMimeTypes,
  videoMimeTypes,
} = require("../../constants/index.constants");
const path = require("path");

const checksForRegisterCourse = (req, file, cb) => {
  let { courseId = "" } = req.query;
  let { tags = [], courseDescription = "" } = req.body;
  if (!courseId) return cb(new Error("Course Id could not be generated"));
  if (!courseDescription)
    return cb(new Error("Course description is not provided"));
  if (!Array.isArray(tags)) tags = [tags];
  if (!tags.length) return cb(new Error("Tags are not provided"));
  const { fieldname = "", mimetype = "" } = file;
  if (
    fieldname === "courseThumbnailImage" &&
    !imageMimeTypes.includes(mimetype)
  )
    return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
  if (fieldname === "courseIntroVideo" && !videoMimeTypes.includes(mimetype))
    return cb(
      new Error(
        "Only .mp4, .m4a, .fmp4, webM, .mkv and apple quicktime format allowed!"
      )
    );
  cb(null, true);
};

const pathForRegisterCourseItems = (req, file) => {
  const { creatorId } = req.body;
  const { courseId } = req.query;
  const { fieldname = "" } = file;
  let pathString = (value) =>
    `courses/${creatorId}/${courseId}/${value}-${uid(
      16
    )}-${creatorId}-${courseId}-${Date.now()}${path.extname(
      file.originalname
    )}`;
  if (fieldname === "courseThumbnailImage") return pathString("thumbnail");
  if (fieldname === "courseIntroVideo") return pathString("introduction-video");
  return "";
};

module.exports = { checksForRegisterCourse, pathForRegisterCourseItems };
