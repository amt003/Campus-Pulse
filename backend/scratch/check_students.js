const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('../models/Student');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const studentsWithResume = await Student.find({ resumePath: { $exists: true, $ne: null } }).limit(10);
    console.log(`Found ${studentsWithResume.length} students with resumePath:`);
    studentsWithResume.forEach(s => {
      console.log(`- Roll: ${s.rollNumber}, Path: ${s.resumePath}`);
    });

    const totalStudents = await Student.countDocuments();
    console.log(`Total students in DB: ${totalStudents}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
