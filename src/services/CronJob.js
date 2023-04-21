const { cronJob } = require("./CourseService");
const cron = require("node-cron");

cron.schedule("00 12 * * *", async function () {
  try {
    const data = await cronJob();
    console.log("🚀 ~ file: CronJob.js:8 ~ dat", data);
  } catch (error) {
    return error;
  }
});
