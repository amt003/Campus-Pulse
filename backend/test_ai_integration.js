const path = require("path");
const aiService = require("./services/aiService");

const test = async () => {
  const sampleResumePath = "/uploads/resumes/1785560421351-604294292-ABEY_MATHEW_Resume_removed.pdf";
  const sampleJd = "We are looking for a Software Engineer Intern with skills in React, Javascript, Node.js, and web development databases.";

  console.log("Starting End-to-End AI scoring test...");
  console.log("Resume Path:", sampleResumePath);
  console.log("Job Description:", sampleJd);

  const result = await aiService.scoreResume(sampleResumePath, sampleJd);
  console.log("\nTest Completed!");
  console.log("Result:", JSON.stringify(result, null, 2));
};

test().catch(console.error);
