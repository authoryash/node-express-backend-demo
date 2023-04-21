const aws = require("aws-sdk");
const { S3 } = require("aws-sdk/clients/all");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { uid } = require("rand-token");
const path = require("path");
const { User } = require("../../models/User");
const {
  userRoles,
  imageMimeTypes,
  purposeTypes,
  registerCourseContentFields,
  lessonVideoContentField,
  editLessonVideoContentField,
  lessonPdfContentField,
} = require("../../constants/index.constants");
const { decryption } = require("../../lib/cipher");
const MentorUser = require("../../models/MentorUser");
const { checkCategoryExists } = require("../../services/AdminService");
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME,
  AWS_BUCKET_REGION,
} = process.env;
const { isEmpty } = require("lodash");
const {
  pathForRegisterCourseItems,
  checksForRegisterCourse,
} = require("./helperFunctionsForRegisterCourse");
const {
  pathForCourseLesson,
  checksForAddingLessons,
  checksForEditLessons,
  // checksForAddingLessonsPdf,
} = require("./helperFunctionsForCourseLessons");

aws.config.update({
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  accessKeyId: AWS_ACCESS_KEY_ID,
  region: AWS_BUCKET_REGION,
});

const awsS3 = new S3();

const checksForUploadProfile = async (authToken, req, cb) => {
  let decodedAuthToken = decryption(authToken);
  decodedAuthToken = JSON.parse(decodedAuthToken);
  if (!decodedAuthToken?.role || !userRoles.includes(decodedAuthToken?.role))
    return cb(new Error("User must be from given roles"));
  let UserSchema = null;
  if (decodedAuthToken?.role === "member") UserSchema = User;
  if (decodedAuthToken?.role === "mentor") UserSchema = MentorUser;
  if (!UserSchema) return cb(new Error("User must be from given roles"));
  const findUser = await UserSchema.findOne({ authToken });
  if (!findUser) return cb(new Error("Unauthorized! Please login again"));
  req.body._id = decodedAuthToken._id;
  req.body.phoneNumber = decodedAuthToken.phoneNumber;
  req.body.email = decodedAuthToken.email;
  req.body.role = decodedAuthToken.role;
  cb(null, true);
};

const checksForposting = async (authToken, req, cb) => {
  let decodedAuthToken = decryption(authToken);
  decodedAuthToken = JSON.parse(decodedAuthToken);
  if (!decodedAuthToken?.role || !userRoles.includes(decodedAuthToken?.role))
    return cb(new Error("User must be from given roles"));
  let UserSchema = null;
  if (decodedAuthToken?.role === "member") UserSchema = User;
  if (decodedAuthToken?.role === "mentor") UserSchema = MentorUser;
  if (!UserSchema) return cb(new Error("User must be from given roles"));
  const findUser = await UserSchema.findOne({ authToken });
  if (!findUser) return cb(new Error("Unauthorized! Please login again"));
  req.body._id = decodedAuthToken._id;
  req.body.phoneNumber = decodedAuthToken.phoneNumber;
  req.body.email = decodedAuthToken.email;
  req.body.role = decodedAuthToken.role;
  cb(null, true);
};

const pathForFile = (_id, categoryName, purpose, file, cb) => {
  let pathVal = "";
  const { fieldname = "" } = file;
  if (fieldname === "profilePic") {
    if (!_id) return cb(new Error("User Id is not provided"));
    pathVal = `Users/${_id}/profilepics/${uid(
      16
    )}-${_id}-${Date.now()}${path.extname(file.originalname)}`;
  }
  if (fieldname === "categoryImageURL") {
    if (!categoryName) return cb(new Error("Category Name is not provided"));
    pathVal = `Wellness Categories/images/Category-${categoryName}/${uid(
      16
    )}-${categoryName}-${Date.now()}${path.extname(file.originalname)}`;
  }
  if (fieldname === "imageUrl") {
    if (!_id) return cb(new Error("User Id is not provided"));
    pathVal = `Users/${_id}/postPics/${uid(
      16
    )}-${_id}-${Date.now()}${path.extname(file.originalname)}`;
  }
  if (pathVal) return cb(null, pathVal);
  cb(new Error("Invalid path for file on cloud"));
};

const upload = multer({
  storage: multerS3({
    s3: awsS3,
    bucket: AWS_BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const { _id = "", categoryName = "", purpose = "" } = req.body;
      pathForFile(_id, categoryName, purpose, file, cb);
    },
  }),
  fileFilter: async function (req, file, cb) {
    const { categoryName = "" } = req.body;
    const { fieldname = "" } = file;
    if (!imageMimeTypes.includes(file.mimetype))
      return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
    if (!purposeTypes.includes(fieldname))
      return cb(new Error("Trying to upload image for unauthorized purpose."));
    if (fieldname === "profilePic") {
      let token = req.headers.authorization?.split(" ")[1];
      if (!token) return cb(new Error("No token provided!"));
      checksForUploadProfile(token, req, cb);
    }
    if (fieldname === "categoryImageURL") {
      if (!categoryName) return cb(new Error("Category Name is not provided"));
      const categoryExists = await checkCategoryExists(categoryName);
      if (!isEmpty(categoryExists))
        return cb(new Error("This category already exists"));
      cb(null, true);
    }
    if (fieldname === "imageUrl") {
      let token = req.headers.authorization?.split(" ")[1];
      if (!token) return cb(new Error("No token provided!"));
      checksForposting(token, req, cb);
    }
  },
});

const uploadVideo = multer({
  storage: multerS3({
    s3: awsS3,
    bucket: AWS_BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const { fieldname = "" } = file;
      let pathVal = "";
      if (registerCourseContentFields.includes(fieldname))
        pathVal = pathForRegisterCourseItems(req, file);
      if (
        [
          lessonVideoContentField,
          editLessonVideoContentField,
          lessonPdfContentField,
        ].includes(fieldname)
      )
        pathVal = pathForCourseLesson(req, file);
      if (!pathVal) return cb(new Error("Invalid path for file on cloud"));
      cb(null, pathVal);
    },
  }),
  fileFilter: async function (req, file, cb) {
    const { fieldname = "" } = file;
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return cb(new Error("No token provided!"));
    if (
      ![
        ...registerCourseContentFields,
        lessonVideoContentField,
        editLessonVideoContentField,
        lessonPdfContentField,
      ].includes(fieldname)
    )
      return cb(new Error("Invalid field value has been passed"));
    if (registerCourseContentFields.includes(fieldname))
      return checksForRegisterCourse(req, file, cb);
    if ([lessonPdfContentField, lessonVideoContentField].includes(fieldname))
      return checksForAddingLessons(req.body, file, cb);
    if (editLessonVideoContentField === fieldname)
      return checksForEditLessons(req.body, file, cb);
    return cb(new Error("Invalid use case for file uploading"));
  },
});

const DeleteObjects = async (Objects) => {
  const DelResult = await awsS3
    .deleteObjects({ Bucket: AWS_BUCKET_NAME, Delete: { Objects } })
    .promise();
  console.log("Delete result", DelResult);
  return DelResult;
};

const RenameObject = async (OLD_KEY, NEW_KEY) => {
  try {
    const copyObj = await awsS3
      .copyObject({
        Bucket: AWS_BUCKET_NAME,
        CopySource: `${AWS_BUCKET_NAME}/${OLD_KEY}`,
        Key: NEW_KEY,
        ACL: "public-read",
      })
      .promise();
    if (!isEmpty(copyObj)) await DeleteObjects([{ Key: OLD_KEY }]);
    return { success: true, result: copyObj };
  } catch (error) {
    if (error.code === "NoSuchKey")
      return { success: false, error: "The Specified video does not exists" };
    return { success: false, error };
  }
};

const uploadProduct = multer({
  storage: multerS3({
    s3: awsS3,
    bucket: AWS_BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const { originalname } = file;
      const { productId } = req.query;
      cb(null, `Products/ProductImage/product-${productId}${path.extname(originalname)}`)
    }
  }),
  fileFilter: function (req, file, cb) {
    const { mimetype = '' } = file;
    if (!imageMimeTypes.includes(mimetype))
      return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
    return cb(null, true)
  }
})

module.exports = { upload, uploadVideo, DeleteObjects, RenameObject, uploadProduct };
