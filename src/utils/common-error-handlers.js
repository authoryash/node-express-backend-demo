const { DeleteObjects } = require("../middlewares/index.middleware");
const { Exception } = require("./httpHandlers");

const CatchErrorHandler = (
  res,
  error,
  message,
  lessonKey = "",
  lessonPdfKey = ""
) => {
  if (lessonKey)
    DeleteObjects([
      { Key: lessonKey },
      ...(lessonPdfKey ? [{ Key: lessonPdfKey }] : []),
    ]);
  if (typeof error === "string") return Exception(res, 400, error);
  return Exception(res, 400, `Unexpected Error! ${message} failed`, error);
};

module.exports = { CatchErrorHandler };
