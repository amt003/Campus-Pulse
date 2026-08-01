const mongoose = require('mongoose');
const User = require('./models/User');
const Recruiter = require('./models/Recruiter');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find all recruiters
    const recruiters = await Recruiter.find({});
    console.log(`Found ${recruiters.length} recruiters to migrate.`);
    
    for (const r of recruiters) {
      const user = await User.findById(r.userId);
      let newStatus = "Pending";
      
      if (r.isApproved) {
        newStatus = "Approved";
      } else if (user && !user.isActive) {
        newStatus = "Rejected";
      }
      
      r.status = newStatus;
      await r.save();
      console.log(`Updated recruiter ${r.companyName} to status: ${newStatus}`);
    }
    
    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
