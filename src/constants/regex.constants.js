const RegexConst = {
  onlyNumberRegex: /^[0-9]+$/,
  phoneNumberRegex: /^\+[0-9]+$/,
  timeRegex: /^[0-9]+$/,
  regexForBucketFileNaming: /^(?!.*(\/|~\|)).+$/,
  lessonNumberReplaceRegex: /^\([0-9]+\)-/,
  lessonTitleReplaceRegex: /-\(.+\)-/,
};

module.exports = RegexConst;
