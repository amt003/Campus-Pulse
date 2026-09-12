const User = require("../models/User");
const JobDrive = require("../models/JobDrive");
const Student = require("../models/Student");
const Application = require("../models/Application");
const { getResourcesForSuggestion } = require("./learningResourceService");

/**
 * Placement Readiness Analyzer (PRA) Service
 * Computes multi-factor readiness scores, stage funnels, skill radars, and department-level analytics.
 */

/**
 * 1. Compute Individual PRA Score and Analytics for a single student
 * @param {string|ObjectId} studentId 
 */
async function computeIndividualPRA(studentId) {
  const student = await Student.findById(studentId).populate("userId", "name email phone");
  if (!student) {
    throw new Error("Student not found");
  }

  // Fetch all applications submitted by the student
  const applications = await Application.find({ studentId: student._id })
    .populate("driveId", "companyName jobRole title jobTitle")
    .lean();

  // 1. CGPA Score (20% weight) -> (CGPA / 10) * 100
  const cgpaRaw = student.cgpa || 0;
  const cgpaScore = Math.min(100, Math.max(0, Math.round((cgpaRaw / 10) * 100)));

  // 2. AI Match Score Avg (25% weight)
  let totalMatchScore = 0;
  let matchCount = 0;
  applications.forEach((app) => {
    const score = app.aiMatchScore ?? app.xai?.matchScore;
    if (typeof score === "number" && !isNaN(score)) {
      totalMatchScore += score;
      matchCount++;
    }
  });

  let aiMatchScore = 0;
  if (matchCount > 0) {
    aiMatchScore = Math.round(totalMatchScore / matchCount);
  } else {
    // 0 if no drive evaluations exist yet
    aiMatchScore = 0;
  }

  // 3. Aptitude Pass Rate (20% weight)
  let aptAttempted = 0;
  let aptPassed = 0;
  let aptTotalScore = 0;
  let aptScoreCount = 0;

  applications.forEach((app) => {
    if (app.aptitude && app.aptitude.status && app.aptitude.status !== "Not Applicable") {
      aptAttempted++;
      if (app.aptitude.status === "Passed") {
        aptPassed++;
      }
      if (typeof app.aptitude.score === "number") {
        aptTotalScore += app.aptitude.score;
        aptScoreCount++;
      }
    }
  });

  let aptitudeScore = 0;
  if (aptAttempted > 0) {
    aptitudeScore = Math.round((aptPassed / aptAttempted) * 100);
  } else {
    // 0 if not attempted
    aptitudeScore = 0;
  }

  // 4. GD Pass Rate (15% weight)
  let gdAttempted = 0;
  let gdShortlisted = 0;
  applications.forEach((app) => {
    if (app.gd && app.gd.status && app.gd.status !== "Not Applicable") {
      gdAttempted++;
      if (app.gd.status === "Shortlisted") {
        gdShortlisted++;
      }
    }
  });

  let gdScore = 0;
  if (gdAttempted > 0) {
    gdScore = Math.round((gdShortlisted / gdAttempted) * 100);
  } else {
    // 0 if not attempted
    gdScore = 0;
  }

  // 5. Interview Pass Rate (10% weight)
  let interviewAttempted = 0;
  let interviewSelected = 0;
  applications.forEach((app) => {
    if (app.interview && (app.interview.status === "Completed" || app.interview.result !== "Pending")) {
      interviewAttempted++;
      if (app.interview.result === "Selected") {
        interviewSelected++;
      }
    }
  });

  let interviewScore = 0;
  if (interviewAttempted > 0) {
    interviewScore = Math.round((interviewSelected / interviewAttempted) * 100);
  } else {
    // 0 if not attempted
    interviewScore = 0;
  }

  // 6. Resume Completeness (10% weight)
  let resumeScore = 0;
  if (student.resumePath) {
    resumeScore = 100;
  } else if (student.isProfileComplete) {
    resumeScore = 50;
  } else {
    resumeScore = 20;
  }

  // Penalty for active backlogs: 5 points deduction per active backlog (capped at 20)
  const backlogPenalty = Math.min(20, (student.activeBacklogs || 0) * 5);

  // Compute final PRA Score
  const subScores = {
    cgpa: cgpaScore,
    aiMatch: aiMatchScore,
    aptitude: aptitudeScore,
    gd: gdScore,
    interview: interviewScore,
    resume: resumeScore,
  };

  const rawPra = 
    (subScores.cgpa * 0.20) +
    (subScores.aiMatch * 0.25) +
    (subScores.aptitude * 0.20) +
    (subScores.gd * 0.15) +
    (subScores.interview * 0.10) +
    (subScores.resume * 0.10) -
    backlogPenalty;

  const praScore = Math.min(100, Math.max(0, Math.round(rawPra)));

  // Category
  let praCategory = "Needs Significant Improvement";
  if (praScore >= 75) {
    praCategory = "Well Prepared";
  } else if (praScore >= 45) {
    praCategory = "Needs Improvement";
  }

  // Stage Conversion Funnel
  const appliedCount = applications.length;
  let aptitudeClearedCount = 0;
  let gdClearedCount = 0;
  let interviewClearedCount = 0;
  let placedCount = 0;

  const advancedStagesAfterAptitude = [
    "Aptitude Completed", "GD Scheduled", "GD Completed", "Interview Scheduled", 
    "Interview Completed", "Selected", "Offer Sent", "Offer Accepted", "Offer Declined", "Placed"
  ];
  const advancedStagesAfterGd = [
    "GD Completed", "Interview Scheduled", "Interview Completed", 
    "Selected", "Offer Sent", "Offer Accepted", "Offer Declined", "Placed"
  ];
  const advancedStagesAfterInterview = [
    "Interview Completed", "Selected", "Offer Sent", "Offer Accepted", "Offer Declined", "Placed"
  ];
  const placedStages = ["Selected", "Offer Accepted", "Placed"];

  applications.forEach((app) => {
    const s = app.status;
    if (app.aptitude?.status === "Passed" || advancedStagesAfterAptitude.includes(s)) {
      aptitudeClearedCount++;
    }
    if (app.gd?.status === "Shortlisted" || advancedStagesAfterGd.includes(s)) {
      gdClearedCount++;
    }
    if (app.interview?.result === "Selected" || advancedStagesAfterInterview.includes(s)) {
      interviewClearedCount++;
    }
    if (placedStages.includes(s)) {
      placedCount++;
    }
  });

  const stageFunnel = {
    applied: appliedCount,
    aptitudeCleared: aptitudeClearedCount,
    gdCleared: gdClearedCount,
    interviewCleared: interviewClearedCount,
    placed: placedCount,
  };

  // Determine weakest stage
  let weakestStage = "No Applications Submitted";
  const dropAptitude = appliedCount > 0 ? (appliedCount - aptitudeClearedCount) / appliedCount : 0;
  const dropGd = aptitudeClearedCount > 0 ? (aptitudeClearedCount - gdClearedCount) / aptitudeClearedCount : 0;
  const dropInterview = gdClearedCount > 0 ? (gdClearedCount - interviewClearedCount) / gdClearedCount : 0;

  if (appliedCount === 0) {
    weakestStage = "No Applications Submitted";
  } else if (subScores.resume < 60) {
    weakestStage = "Resume Profile";
  } else if (subScores.aiMatch < 55) {
    weakestStage = "Resume Keyword Match";
  } else if (dropGd >= dropAptitude && dropGd >= dropInterview && aptitudeClearedCount > 0) {
    weakestStage = "GD";
  } else if (dropInterview >= dropAptitude && dropInterview >= dropGd && gdClearedCount > 0) {
    weakestStage = "Interview";
  } else if (subScores.aptitude < 65) {
    weakestStage = "Aptitude";
  } else {
    // Default lowest sub-score
    const testScores = [
      { name: "Aptitude", val: subScores.aptitude },
      { name: "GD", val: subScores.gd },
      { name: "Interview", val: subScores.interview },
    ];
    testScores.sort((a, b) => a.val - b.val);
    weakestStage = testScores[0].name;
  }

  // Aggregate recurring skill gaps from XAI
  const skillGapFrequency = {};
  const positiveSentencesPool = [];
  applications.forEach((app) => {
    if (app.xai?.skillGaps && Array.isArray(app.xai.skillGaps)) {
      app.xai.skillGaps.forEach((skill) => {
        const cleaned = skill.trim();
        if (cleaned) {
          skillGapFrequency[cleaned] = (skillGapFrequency[cleaned] || 0) + 1;
        }
      });
    }
    if (app.xai?.positiveSentences && Array.isArray(app.xai.positiveSentences)) {
      positiveSentencesPool.push(...app.xai.positiveSentences);
    }
    if (app.xai?.strongSkills && Array.isArray(app.xai.strongSkills)) {
      positiveSentencesPool.push(...app.xai.strongSkills);
    }
  });

  const sortedGaps = Object.entries(skillGapFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);

  // Return only real gaps discovered during actual drive evaluations (no fake fallback gaps)
  const recurringSkillGaps = sortedGaps.slice(0, 5);

  // Compute 6-axis Skill Radar (0-10 scale)
  const positiveText = positiveSentencesPool.join(" ").toLowerCase();

  // 1. DSA
  let dsaVal = applications.length > 0 ? 5.0 : 0;
  if (/dsa|data structure|algorithm|tree|graph|dynamic programming|leetcode/i.test(positiveText)) {
    dsaVal = 8.5;
  } else if (applications.length > 0 && cgpaRaw >= 8.5) {
    dsaVal = 7.5;
  } else if (applications.length > 0) {
    dsaVal = cgpaRaw >= 6.5 ? 6.0 : 4.5;
  } else if (cgpaRaw >= 8.0) {
    dsaVal = 5.0; // Academic foundation only
  }

  // 2. Cloud
  let cloudVal = 0;
  if (/aws|docker|kubernetes|cloud|gcp|azure|devops/i.test(positiveText)) {
    cloudVal = 8.0;
  } else if (recurringSkillGaps.some(g => /aws|docker|cloud|kubernetes/i.test(g))) {
    cloudVal = 3.5;
  } else if (applications.length > 0) {
    cloudVal = 2.0;
  }

  // 3. Web Dev
  let webVal = 0;
  if (/react|node|angular|javascript|typescript|express|mongodb|frontend|backend|fullstack/i.test(positiveText)) {
    webVal = 8.5;
  } else if (student.branch && /cs|it|cse|computer|mca/i.test(student.branch)) {
    webVal = applications.length > 0 ? 6.5 : 4.0;
  }

  // 4. Aptitude (0 if unattempted)
  let aptVal = aptAttempted > 0 
    ? Math.min(10, Math.max(1, Math.round((subScores.aptitude / 10) * 10) / 10)) 
    : 0;

  // 5. Communication (0 if unattempted)
  let commVal = gdAttempted > 0 
    ? Math.min(10, Math.max(1, Math.round((subScores.gd / 10) * 10) / 10)) 
    : 0;

  // 6. Interview (0 if unattempted)
  let intVal = interviewAttempted > 0 
    ? Math.min(10, Math.max(1, Math.round((subScores.interview / 10) * 10) / 10)) 
    : 0;

  const skillRadar = {
    DSA: Number(dsaVal.toFixed(1)),
    Cloud: Number(cloudVal.toFixed(1)),
    WebDev: Number(webVal.toFixed(1)),
    Aptitude: Number(aptVal.toFixed(1)),
    Communication: Number(commVal.toFixed(1)),
    Interview: Number(intVal.toFixed(1)),
  };

  const subScoreMeta = {
    aptAttempted,
    aptPassed,
    gdAttempted,
    gdShortlisted,
    interviewAttempted,
    interviewSelected,
    matchCount,
    appliedCount,
  };

  // Personalized Suggestions
  const metricsForSuggestions = {
    praScore,
    subScores,
    subScoreMeta,
    weakestStage,
    recurringSkillGaps,
    applicationsCount: applications.length,
    cgpa: cgpaRaw,
    hasResume: !!student.resumePath,
  };

  const personalizedSuggestions = generateSuggestions(metricsForSuggestions);

  return {
    student: {
      _id: student._id,
      name: student.userId?.name || "Student",
      email: student.userId?.email || "",
      rollNumber: student.rollNumber,
      branch: student.branch,
      passoutYear: student.passoutYear,
      cgpa: student.cgpa,
      activeBacklogs: student.activeBacklogs,
      isProfileComplete: student.isProfileComplete,
      hasResume: !!student.resumePath,
    },
    praScore,
    praCategory,
    subScores,
    subScoreMeta,
    stageFunnel,
    weakestStage,
    skillRadar,
    recurringSkillGaps,
    personalizedSuggestions,
    applicationsCount: applications.length,
    lastComputedAt: new Date().toISOString(),
  };
}

/**
 * 2. Rule-Based Suggestion Generator
 * @param {Object} metrics 
 */
function generateSuggestions(metrics) {
  const suggestions = [];
  const { applicationsCount, subScores, subScoreMeta } = metrics;

  // 1. Placement Activity - Prompt candidates with 0 applications
  if (applicationsCount === 0) {
    suggestions.push({
      severity: "critical",
      category: "Placement Activity",
      message: "You have not applied to any on-campus recruitment drives yet. Active drive participation is required to build stage evaluation metrics and gain interview exposure.",
      actions: [
        "Browse eligible recruitment drives in your Student Dashboard",
        "Check upcoming calendar deadlines and apply to active campus drives",
        "Ensure your verified academic percentages and contact details are up to date"
      ],
      resources: getResourcesForSuggestion("Placement Activity"),
    });
  }

  // 2. Resume & ATS Check
  if (!metrics.hasResume) {
    suggestions.push({
      severity: "critical",
      category: "Resume & ATS",
      message: "No verified resume detected on file. Uploading an ATS-compatible PDF resume is mandatory for recruitment drive shortlisting.",
      actions: [
        "Navigate to your Student Profile and upload your updated resume (PDF format)",
        "Highlight core technical skills, projects, and verifiable GitHub/portfolio links",
        "Ensure clean ATS layout without nested tables or complex graphical columns"
      ],
      resources: getResourcesForSuggestion("Resume & ATS"),
    });
  } else if (subScores.aiMatch > 0 && subScores.aiMatch < 60) {
    suggestions.push({
      severity: "critical",
      category: "Resume & ATS",
      message: "Your ATS resume match score is below target threshold across evaluated drives. Missing technical keywords prevents algorithmic shortlisting.",
      actions: [
        "Align resume sections with standard industry ATS formatting",
        "Add measurable impact metrics (e.g., 'Reduced latency by 25%')",
        "Incorporate relevant frameworks mentioned in target job descriptions"
      ],
      resources: getResourcesForSuggestion("Resume & ATS"),
    });
  }

  // 3. Aptitude check - ONLY if the candidate actually attempted aptitude tests
  if (subScoreMeta?.aptAttempted > 0 && subScores.aptitude < 60) {
    suggestions.push({
      severity: "critical",
      category: "Aptitude",
      message: `Your aptitude pass rate is ${subScores.aptitude}% across ${subScoreMeta.aptAttempted} attempted test${subScoreMeta.aptAttempted > 1 ? 's' : ''}. Most tier-1 tech firms use quantitative and logical screening as a strict hard filter.`,
      actions: [
        "Practice 25 quantitative questions daily on PrepInsta & IndiaBIX",
        "Take timed sectional mock tests every alternate day",
        "Focus on Speed Math, Number Systems, and Permutations"
      ],
      resources: getResourcesForSuggestion("Aptitude"),
    });
  }

  // 4. GD / Communication check - ONLY if the candidate actually attempted GD rounds
  if (subScoreMeta?.gdAttempted > 0 && subScores.gd < 50) {
    suggestions.push({
      severity: "critical",
      category: "Communication",
      message: `Your Group Discussion conversion is ${subScores.gd}% (${subScoreMeta.gdShortlisted}/${subScoreMeta.gdAttempted} shortlisted). Focus on articulation, structured arguments, and collaborative listening.`,
      actions: [
        "Participate in mock GD sessions organized by the placement cell",
        "Read daily editorial columns to stay updated on current tech and economic trends",
        "Practice standard structures: Opening, 3 Root Causes, Solutions, and Conciliatory Summaries"
      ],
      resources: getResourcesForSuggestion("Communication"),
    });
  }

  // 5. Technical Interview check - ONLY if the candidate actually attempted interview rounds
  if (subScoreMeta?.interviewAttempted > 0 && subScores.interview < 50) {
    suggestions.push({
      severity: "critical",
      category: "Technical Interview",
      message: `Your technical interview conversion is ${subScores.interview}% across ${subScoreMeta.interviewAttempted} interview round${subScoreMeta.interviewAttempted > 1 ? 's' : ''}.`,
      actions: [
        "Conduct peer mock interviews weekly on Pramp or Interviewing.io",
        "Deep-dive into past project architecture and explain tradeoff decisions clearly",
        "Master complexity analysis (Big-O time and space) for every solution you articulate"
      ],
      resources: getResourcesForSuggestion("Technical Interview"),
    });
  }

  // 6. CGPA portfolio compensation check
  if (metrics.cgpa < 6.5) {
    suggestions.push({
      severity: "moderate",
      category: "Academics",
      message: `Current CGPA (${metrics.cgpa}) is below the common 6.5 / 7.0 eligibility cut-off used by premium recruitment partners.`,
      actions: [
        "Prioritize upcoming semester end-term coursework to raise overall aggregate",
        "Target companies with open-eligibility or skill-first hiring tracks"
      ],
      resources: getResourcesForSuggestion("Portfolio"),
    });
  }

  // 7. Skill Gaps - ONLY if real recurring gaps were detected from actual drive evaluations
  if (applicationsCount > 0 && Array.isArray(metrics.recurringSkillGaps) && metrics.recurringSkillGaps.length > 0) {
    metrics.recurringSkillGaps.slice(0, 2).forEach((skill) => {
      suggestions.push({
        severity: "moderate",
        category: "Skill Gap",
        message: `${skill} was identified as a recurring missing requirement across your drive evaluations.`,
        actions: [
          `Complete hands-on tutorial and build a sample project utilizing ${skill}`,
          `Review official documentation and core design patterns for ${skill}`
        ],
        resources: getResourcesForSuggestion("Skill Gap", skill),
      });
    });
  }

  // 8. Positive reinforcement
  if (metrics.praScore >= 75) {
    suggestions.push({
      severity: "positive",
      category: "Readiness Milestone",
      message: "High Placement Readiness! You are well-positioned across technical match, academics, and stage metrics.",
      actions: [
        "Maintain current cadence with weekly competitive programming practice",
        "Review company-specific past interview experiences and senior insights"
      ],
      resources: getResourcesForSuggestion("Technical Interview"),
    });
  }

  return suggestions;
}

/**
 * 3. Compute Department-level Placement Analytics
 * @param {string} branch - Branch name (e.g., 'CSE', 'ECE') or 'All'
 */
async function computeDepartmentMetrics(branch) {
  const query = {};
  if (branch && branch.toLowerCase() !== "all") {
    query.branch = new RegExp(`^${branch.trim()}$`, "i");
  }

  const students = await Student.find(query).populate("userId", "name email").lean();
  const totalStudents = students.length;

  if (totalStudents === 0) {
    return {
      branch: branch || "All",
      totalStudents: 0,
      placedCount: 0,
      placementPercentage: 0,
      avgPraScore: 0,
      avgCgpa: 0,
      stageDropOff: {
        applied: 0,
        aptitudeCleared: 0,
        gdCleared: 0,
        interviewCleared: 0,
        placed: 0,
      },
      topMissingSkills: [],
      departmentRecommendations: [
        { title: "No Data", desc: "No registered students found in this department." }
      ],
      radarAverage: {
        DSA: 6.0,
        Cloud: 5.0,
        WebDev: 6.5,
        Aptitude: 6.5,
        Communication: 6.0,
        Interview: 6.0,
      },
      highestDropStage: "None",
    };
  }

  const studentIds = students.map((s) => s._id);
  const applications = await Application.find({ studentId: { $in: studentIds } }).lean();

  // Aggregate CGPA
  const sumCgpa = students.reduce((acc, s) => acc + (s.cgpa || 0), 0);
  const avgCgpa = Number((sumCgpa / totalStudents).toFixed(2));

  // Stage metrics
  let totalApplied = applications.length;
  let totalAptitudeCleared = 0;
  let totalGdCleared = 0;
  let totalInterviewCleared = 0;
  const placedStudentSet = new Set();

  const advancedStagesAfterAptitude = [
    "Aptitude Completed", "GD Scheduled", "GD Completed", "Interview Scheduled", 
    "Interview Completed", "Selected", "Offer Sent", "Offer Accepted", "Offer Declined", "Placed"
  ];
  const advancedStagesAfterGd = [
    "GD Completed", "Interview Scheduled", "Interview Completed", 
    "Selected", "Offer Sent", "Offer Accepted", "Offer Declined", "Placed"
  ];
  const advancedStagesAfterInterview = [
    "Interview Completed", "Selected", "Offer Sent", "Offer Accepted", "Offer Declined", "Placed"
  ];
  const placedStages = ["Selected", "Offer Accepted", "Placed"];

  const missingSkillsMap = {};

  applications.forEach((app) => {
    const s = app.status;
    if (app.aptitude?.status === "Passed" || advancedStagesAfterAptitude.includes(s)) {
      totalAptitudeCleared++;
    }
    if (app.gd?.status === "Shortlisted" || advancedStagesAfterGd.includes(s)) {
      totalGdCleared++;
    }
    if (app.interview?.result === "Selected" || advancedStagesAfterInterview.includes(s)) {
      totalInterviewCleared++;
    }
    if (placedStages.includes(s)) {
      placedStudentSet.add(String(app.studentId));
    }

    if (app.xai?.skillGaps && Array.isArray(app.xai.skillGaps)) {
      app.xai.skillGaps.forEach((skill) => {
        const cleaned = skill.trim();
        if (cleaned) {
          missingSkillsMap[cleaned] = (missingSkillsMap[cleaned] || 0) + 1;
        }
      });
    }
  });

  const placedCount = placedStudentSet.size;
  const placementPercentage = Math.round((placedCount / totalStudents) * 100);

  // Top 10 missing skills - derived strictly from student application XAI evaluation data
  const topMissingSkills = Object.entries(missingSkillsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalApplied > 0 ? Math.round((count / totalApplied) * 100) : 0,
    }));

  // Calculate Average Department PRA Score in parallel
  const sampleStudents = students.slice(0, 30);
  const samplePras = await Promise.all(
    sampleStudents.map((s) =>
      computeIndividualPRA(s._id)
        .then((res) => res.praScore)
        .catch(() => Math.min(100, Math.max(0, Math.round((s.cgpa / 10) * 20))))
    )
  );
  const praSum = samplePras.reduce((acc, score) => acc + score, 0);
  const avgPraScore = samplePras.length > 0 ? Math.round(praSum / samplePras.length) : 0;

  // Determine stage with highest drop-off
  const drop1 = totalApplied > 0 ? (totalApplied - totalAptitudeCleared) / totalApplied : 0;
  const drop2 = totalAptitudeCleared > 0 ? (totalAptitudeCleared - totalGdCleared) / totalAptitudeCleared : 0;
  const drop3 = totalGdCleared > 0 ? (totalGdCleared - totalInterviewCleared) / totalGdCleared : 0;

  let highestDropStage = "None";
  if (totalApplied === 0) {
    highestDropStage = "No Applications Submitted";
  } else if (drop2 > drop1 && drop2 > drop3 && totalAptitudeCleared > 0) {
    highestDropStage = "Group Discussion (GD)";
  } else if (drop3 > drop1 && drop3 > drop2 && totalGdCleared > 0) {
    highestDropStage = "Technical Interview";
  } else if (drop1 > 0) {
    highestDropStage = "Aptitude Round";
  }

  // Real-time Department Directives
  const departmentRecommendations = [];

  if (totalApplied === 0) {
    departmentRecommendations.push({
      priority: "high",
      title: "Activate Campus Recruitment Participation",
      desc: `All ${totalStudents} registered students in this department have zero drive applications on record. Announce upcoming eligible company drives and establish registration deadlines.`,
      icon: "campaign"
    });
    departmentRecommendations.push({
      priority: "medium",
      title: "Cohort Resume Verification Audit",
      desc: "Audit final-year student profiles to ensure 100% of candidates have uploaded verified ATS-compatible PDF resumes before upcoming recruitment drives.",
      icon: "verified"
    });
    departmentRecommendations.push({
      priority: "medium",
      title: "Pre-Placement Aptitude & Soft Skills Orientation",
      desc: "Conduct foundational aptitude mock tests and communication workshops to prepare students before company screening commences.",
      icon: "psychology"
    });
  } else {
    // Data-driven triggers based on real drive results
    if (drop1 > 0.40 || (totalApplied > 0 && (totalAptitudeCleared / totalApplied) < 0.6)) {
      departmentRecommendations.push({
        priority: "high",
        title: "Mandate Intensive Quantitative Bootcamp",
        desc: `${Math.round(drop1 * 100)}% of candidates dropped during aptitude screening (${totalApplied - totalAptitudeCleared}/${totalApplied} unselected). Coordinate with training partners for timed quantitative reasoning drills.`,
        icon: "psychology"
      });
    }

    if (topMissingSkills.length > 0) {
      const topSkill = topMissingSkills[0];
      departmentRecommendations.push({
        priority: "high",
        title: `Host Hands-on ${topSkill.name} Technical Workshop`,
        desc: `${topSkill.count} student applications flagged missing competencies in ${topSkill.name} (${topSkill.percentage}% of applied candidates). Organize a focused technical workshop or practical module.`,
        icon: "terminal"
      });
    }

    if (drop2 > 0.35 && totalAptitudeCleared > 0) {
      departmentRecommendations.push({
        priority: "medium",
        title: "Institutionalize Peer GD Roundtables",
        desc: `${Math.round(drop2 * 100)}% drop rate detected in Group Discussion phases (${totalAptitudeCleared - totalGdCleared}/${totalAptitudeCleared} dropped). Implement faculty-moderated communication circles.`,
        icon: "groups"
      });
    }

    if (drop3 > 0.35 && totalGdCleared > 0) {
      departmentRecommendations.push({
        priority: "high",
        title: "Conduct 1-on-1 Technical Mock Interviews",
        desc: `${Math.round(drop3 * 100)}% of candidates cleared GD but dropped at Technical/HR interviews (${totalGdCleared - totalInterviewCleared}/${totalGdCleared} dropped). Arrange domain-expert mock interviews.`,
        icon: "record_voice_over"
      });
    }

    if (placementPercentage < 65) {
      departmentRecommendations.push({
        priority: "medium",
        title: "Schedule Targeted Corporate Outreach",
        desc: `Department placement rate currently stands at ${placementPercentage}% (${placedCount}/${totalStudents} placed). Engage corporate partners and alumni networks for additional hiring slots.`,
        icon: "business_center"
      });
    }

    if (departmentRecommendations.length < 3) {
      departmentRecommendations.push({
        priority: "low",
        title: "Resume & Portfolio Verification Audit",
        desc: "Ensure 100% of final year students have verified ATS-compatible resumes and deployed project links before upcoming enterprise drives.",
        icon: "verified"
      });
    }
  }

  // Department Radar benchmarks
  const radarAverage = {
    DSA: Number((avgCgpa * 0.85).toFixed(1)),
    Cloud: 5.2,
    WebDev: 6.8,
    Aptitude: Number((avgPraScore / 10).toFixed(1)),
    Communication: 6.2,
    Interview: 6.0,
  };

  return {
    branch: branch || "All",
    totalStudents,
    placedCount,
    placementPercentage,
    avgPraScore,
    avgCgpa,
    stageDropOff: {
      applied: totalApplied,
      aptitudeCleared: totalAptitudeCleared,
      gdCleared: totalGdCleared,
      interviewCleared: totalInterviewCleared,
      placed: placedCount,
    },
    topMissingSkills,
    departmentRecommendations,
    radarAverage,
    highestDropStage,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 4. Compute PRA for all students in branch / college for TPO Leaderboard
 * @param {string} branch 
 * @param {string} sort 
 */
async function computeAllStudentsPRA(branch, sort = "pra") {
  const query = {};
  if (branch && branch.toLowerCase() !== "all") {
    query.branch = new RegExp(`^${branch.trim()}$`, "i");
  }

  const students = await Student.find(query).populate("userId", "name email").lean();

  const results = await Promise.all(
    students.map(async (s) => {
      try {
        const pra = await computeIndividualPRA(s._id);
        return {
          studentId: s._id,
          rollNumber: s.rollNumber,
          name: s.userId?.name || "Student",
          email: s.userId?.email || "",
          branch: s.branch,
          passoutYear: s.passoutYear,
          cgpa: s.cgpa,
          praScore: pra.praScore,
          praCategory: pra.praCategory,
          weakestStage: pra.weakestStage,
          applicationsCount: pra.applicationsCount,
          hasResume: !!s.resumePath,
          activeBacklogs: s.activeBacklogs || 0,
        };
      } catch {
        const basePra = Math.min(100, Math.max(30, Math.round((s.cgpa / 10) * 85)));
        return {
          studentId: s._id,
          rollNumber: s.rollNumber,
          name: s.userId?.name || "Student",
          email: s.userId?.email || "",
          branch: s.branch,
          passoutYear: s.passoutYear,
          cgpa: s.cgpa,
          praScore: basePra,
          praCategory: basePra >= 75 ? "Well Prepared" : "Needs Improvement",
          weakestStage: "Aptitude",
          applicationsCount: 0,
          hasResume: !!s.resumePath,
          activeBacklogs: s.activeBacklogs || 0,
        };
      }
    })
  );

  // Sort
  if (sort === "cgpa") {
    results.sort((a, b) => b.cgpa - a.cgpa);
  } else if (sort === "roll") {
    results.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  } else {
    // Default: by praScore descending
    results.sort((a, b) => b.praScore - a.praScore);
  }

  // Assign ranks
  return results.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));
}

/**
 * 5. Get Department Radar Average benchmark
 * @param {string} branch 
 */
async function getDepartmentRadarAverage(branch) {
  const dept = await computeDepartmentMetrics(branch);
  return dept.radarAverage;
}

module.exports = {
  computeIndividualPRA,
  generateSuggestions,
  computeDepartmentMetrics,
  computeAllStudentsPRA,
  getDepartmentRadarAverage,
};
