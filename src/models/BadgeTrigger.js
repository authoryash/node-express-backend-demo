const { Schema, model } = require("mongoose");

/* 
  in trigger condition use format {keyword}-{conditional value parameter}
  exe for badges earned based on progress I have created triggercondition like
  progress-25 here I will reference progress keyword for identifing type of trigger and 25 is the percentage on which the badge will trigger
*/
const BadgeTriggerSchema = new Schema(
  {
    triggerName: {
      type: String,
      required: true,
      unique: true,
    },
    triggerCondition: {
      type: String,
      required: true,
    },
    weightage: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = model("BadgeTriggers", BadgeTriggerSchema);
