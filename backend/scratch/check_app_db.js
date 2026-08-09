const mongoose = require("mongoose");

const MONGODB_URI = "mongodb+srv://AbeyMathew03:Abey2003@campuspulse-cluster.e4wugqp.mongodb.net/?appName=CampusPulse-Cluster";

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", UserSchema, "users");

const StudentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.model("Student", StudentSchema, "students");

const ApplicationSchema = new mongoose.Schema({}, { strict: false });
const Application = mongoose.model("Application", ApplicationSchema, "applications");

const ScheduleSchema = new mongoose.Schema({}, { strict: false });
const Schedule = mongoose.model("Schedule", ScheduleSchema, "schedules");

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!");

    const user = await User.findOne({ email: 'abeymathew2003@gmail.com' });
    console.log("User:", user ? user._id : "not found");

    if (user) {
      const student = await Student.findOne({ userId: user._id });
      console.log("Student Profile ID:", student ? student._id : "not found");

      if (student) {
        const apps = await Application.find({ studentId: student._id });
        console.log("Applications count:", apps.length);
        for (let app of apps) {
          console.log("-----------------------------------------");
          console.log("App _id:", app._id);
          console.log("App status:", app.get("status"));
          console.log("App aptitude:", app.get("aptitude"));
          console.log("App gd:", app.get("gd"));
          console.log("App interview:", app.get("interview"));
          console.log("App xai:", app.get("xai"));

          const schedules = await Schedule.find({ applicationId: app._id });
          console.log("Schedules count:", schedules.length);
          schedules.forEach(s => {
            console.log(`- Schedule: eventType=${s.eventType}, status=${s.status}, date=${s.date}, timeSlot=${s.timeSlot}, location=${s.location}`);
          });
        }
      }
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

check();
