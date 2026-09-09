const CollegeConfig = require('../models/CollegeConfig');

const initializeCollegeConfig = async () => {
  try {
    let existingConfig = await CollegeConfig.findOne();
    if (!existingConfig) {
      existingConfig = await CollegeConfig.create({
        branches: ['BCA', 'MCA', 'INMCA', 'ECE', 'CSE', 'IT', 'EEE', 'ME', 'CE', 'AD'],
        passoutYears: [2024, 2025, 2026, 2027, 2028],
      });
      console.log('✅ CollegeConfig initialized with default values.');
    } else {
      let updated = false;
      if (!existingConfig.branches || existingConfig.branches.length === 0) {
        existingConfig.branches = ['BCA', 'MCA', 'INMCA', 'ECE', 'CSE', 'IT', 'EEE', 'ME', 'CE', 'AD'];
        updated = true;
      }
      if (!existingConfig.passoutYears || existingConfig.passoutYears.length === 0) {
        existingConfig.passoutYears = [2024, 2025, 2026, 2027, 2028];
        updated = true;
      }
      if (updated) {
        await existingConfig.save();
        console.log('✅ CollegeConfig updated missing default branches/years.');
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize CollegeConfig:', error.message);
  }
};

module.exports = { initializeCollegeConfig };
