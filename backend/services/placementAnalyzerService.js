const User = require("../models/User");
const JobDrive = require("../models/JobDrive");
const Student = require("../models/Student");
const Application = require("../models/Application");
const { getResourcesForSuggestion } = require("./learningResourceService");

/**
 * Clean & normalize technical skill names and filter boilerplate phrases
 */
function extractCleanSkills(rawList) {
  if (!Array.isArray(rawList)) return [];

  const techDictionary = [
    { pattern: /\b(c#|\.net)\b/i, name: "C# / .NET" },
    { pattern: /\b(c\+\+)\b/i, name: "C++" },
    { pattern: /\b(python)\b/i, name: "Python" },
    { pattern: /\b(java)\b/i, name: "Java" },
    { pattern: /\b(spring\s*boot)\b/i, name: "Spring Boot" },
    { pattern: /\b(django)\b/i, name: "Django" },
    { pattern: /\b(node(\.js)?|express(\.js)?)\b/i, name: "Node.js / Express" },
    { pattern: /\b(react(\.js)?)\b/i, name: "React.js" },
    { pattern: /\b(angular)\b/i, name: "Angular" },
    { pattern: /\b(html|css|javascript|typescript)\b/i, name: "HTML5 / CSS / JavaScript" },
    { pattern: /\b(sql|mysql|postgresql|relational)\b/i, name: "SQL & Relational Databases" },
    { pattern: /\b(mongodb|nosql)\b/i, name: "MongoDB & NoSQL" },
    { pattern: /\b(docker)\b/i, name: "Docker Containerization" },
    { pattern: /\b(kubernetes)\b/i, name: "Kubernetes" },
    { pattern: /\b(aws|amazon web services)\b/i, name: "AWS Cloud" },
    { pattern: /\b(azure)\b/i, name: "Microsoft Azure" },
    { pattern: /\b(gcp|google cloud)\b/i, name: "Google Cloud Platform" },
    { pattern: /\b(cloud)\b/i, name: "Cloud Computing" },
    { pattern: /\b(git|github|version control)\b/i, name: "Git & Version Control" },
    { pattern: /\b(rest(\s*apis?)?|web services)\b/i, name: "RESTful APIs & Web Services" },
    { pattern: /\b(pandas|numpy|matplotlib)\b/i, name: "Pandas, NumPy & Data Analysis" },
    { pattern: /\b(power\s*bi|tableau)\b/i, name: "Power BI / Tableau" },
    { pattern: /\b(excel|spreadsheet)\b/i, name: "Advanced Microsoft Excel" },
    { pattern: /\b(oop|object[-\s]oriented)\b/i, name: "Object-Oriented Programming (OOP)" },
    { pattern: /\b(data pipeline|etl|preprocessing)\b/i, name: "Data Pipelines & ETL" },
    { pattern: /\b(agile|scrum)\b/i, name: "Agile & Scrum Methodologies" },
    { pattern: /\b(dsa|data structure|algorithm)\b/i, name: "Data Structures & Algorithms" },
    { pattern: /\b(system design|microservices)\b/i, name: "System Design & Microservices" },
    { pattern: /\b(statistics|statistical)\b/i, name: "Statistical Modeling & Analysis" },
    { pattern: /\b(machine learning|deep learning|inference)\b/i, name: "Machine Learning & AI" }
  ];

  const boilerplatePatterns = [
    /^employment type/i,
    /^job title/i,
    /^company/i,
    /^work location/i,
    /^the selected candidate/i,
    /^the candidate will/i,
    /^eligib/i,
    /^preferred qualification/i,
    /^currently pursuing/i,
    /^tcs is looking/i,
    /^we are looking/i,
    /^responsibilities/i,
    /^requirements/i,
    /^about us/i,
    /^strong attention to detail/i,
    /^identify data quality/i,
    /^communicate analytical/i,
    /^collaborate with/i,
    /^prepare regular/i,
    /^academic projects/i,
    /^perform exploratory/i,
    /^write sql queries/i,
    /^collect, clean/i,
    /^document and present/i
  ];

  const extracted = new Set();

  rawList.forEach(raw => {
    if (!raw || typeof raw !== "string") return;
    let s = raw.trim().replace(/\.+$/, "").trim();

    // Check if matched by tech dictionary
    let matched = false;
    for (const dict of techDictionary) {
      if (dict.pattern.test(s)) {
        extracted.add(dict.name);
        matched = true;
      }
    }

    if (!matched) {
      const isBoilerplate = boilerplatePatterns.some(bp => bp.test(s));
      if (!isBoilerplate && s.length >= 2 && s.length <= 35) {
        const cleanName = s.replace(/\b\w/g, c => c.toUpperCase());
        extracted.add(cleanName);
      }
    }
  });

  return Array.from(extracted);
}

/**
 * Placement Readiness Analyzer (PRA) Service
 * Computes multi-factor readiness scores, stage funnels, skill radars, and department-level analytics.
 */

/**
 * Tier 1 Helper: Compute Weighted Geometric Mean PRA Score
 * Penalizes zero-skill bottlenecks (e.g. 0% in Aptitude) by multiplying sub-scores.
 * Sub-scores are floored at 1.0 to prevent total zero multiplication while retaining maximum bottleneck penalty.
 */
function calculateGeometricPRA(scoresObj, penalty = 0) {
  const weights = {
    cgpa: 0.20,
    aiMatch: 0.25,
    aptitude: 0.20,
    gd: 0.15,
    interview: 0.10,
    resume: 0.10,
  };

  let product = 1.0;
  for (const [key, weight] of Object.entries(weights)) {
    const val = Math.max(1, scoresObj[key] || 0);
    product *= Math.pow(val, weight);
  }

  const rawPra = product - penalty;
  return Math.min(100, Math.max(0, Math.round(rawPra)));
}

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

  // Tier 1 Helper: Calculate Exponential Recency Weight (45-day half-life)
  const calculateRecencyWeight = (date) => {
    if (!date) return 1.0;
    const diffDays = Math.max(0, (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return Math.exp(-0.0154 * diffDays);
  };

  // Tier 1 Helper: Compute Bayesian-smoothed clearance rate
  const calculateBayesianRate = (weightedSuccess, weightedAttempts, priorRate = 0.60, priorWeight = 2.0) => {
    return Math.min(100, Math.max(0, Math.round(((weightedSuccess + priorWeight * priorRate) / (weightedAttempts + priorWeight)) * 100)));
  };

  // 1. CGPA Score (20% weight) -> (CGPA / 10) * 100
  const cgpaRaw = student.cgpa || 0;
  const cgpaScore = Math.min(100, Math.max(0, Math.round((cgpaRaw / 10) * 100)));

  // 2. AI Match Score Avg (25% weight) with Recency Weighting & Cold-Start Prior
  let totalWeightedMatch = 0;
  let totalMatchWeight = 0;
  let matchCount = 0;
  applications.forEach((app) => {
    const score = app.aiMatchScore ?? app.xai?.matchScore;
    if (typeof score === "number" && !isNaN(score)) {
      const w = calculateRecencyWeight(app.createdAt || app.updatedAt);
      totalWeightedMatch += score * w;
      totalMatchWeight += w;
      matchCount++;
    }
  });

  let aiMatchScore = 0;
  const hasResume = !!student.resumePath;
  if (matchCount > 0) {
    // Blend empirical weighted match with baseline prior (prior: 60, weight: 1.5)
    aiMatchScore = Math.min(100, Math.max(0, Math.round((totalWeightedMatch + 1.5 * 60) / (totalMatchWeight + 1.5))));
  } else if (hasResume) {
    // Dynamic cold-start baseline (45 - 75) based on profile completeness & academic standing
    let base = 55;
    if (student.cgpa >= 8.5) base += 12;
    else if (student.cgpa >= 7.5) base += 8;
    else if (student.cgpa >= 6.5) base += 4;

    if ((student.activeBacklogs || 0) === 0) base += 5;
    if (student.isProfileComplete) base += 3;

    aiMatchScore = Math.min(75, Math.max(45, base));
  } else {
    // Baseline for candidates without uploaded resume
    aiMatchScore = student.isProfileComplete ? 45 : 30;
  }

  // 3. Aptitude Pass Rate (20% weight) with Bayesian Smoothing & Recency
  let aptAttempted = 0;
  let aptPassed = 0;
  let weightedAptAttempted = 0;
  let weightedAptPassed = 0;

  applications.forEach((app) => {
    if (app.aptitude && app.aptitude.status && app.aptitude.status !== "Not Applicable") {
      aptAttempted++;
      const w = calculateRecencyWeight(app.aptitude.markedAt || app.updatedAt || app.createdAt);
      weightedAptAttempted += w;
      if (app.aptitude.status === "Passed") {
        aptPassed++;
        weightedAptPassed += w;
      }
    }
  });

  // Prior: 60% baseline, prior weight: 2 attempts
  const aptitudeScore = calculateBayesianRate(weightedAptPassed, weightedAptAttempted, 0.60, 2.0);

  // 4. GD Pass Rate (15% weight) with Bayesian Smoothing & Recency
  let gdAttempted = 0;
  let gdShortlisted = 0;
  let weightedGdAttempted = 0;
  let weightedGdShortlisted = 0;

  applications.forEach((app) => {
    if (app.gd && app.gd.status && app.gd.status !== "Not Applicable") {
      gdAttempted++;
      const w = calculateRecencyWeight(app.gd.markedAt || app.updatedAt || app.createdAt);
      weightedGdAttempted += w;
      if (app.gd.status === "Shortlisted") {
        gdShortlisted++;
        weightedGdShortlisted += w;
      }
    }
  });

  // Prior: 60% baseline, prior weight: 2 attempts
  const gdScore = calculateBayesianRate(weightedGdShortlisted, weightedGdAttempted, 0.60, 2.0);

  // 5. Interview Pass Rate (10% weight) with Bayesian Smoothing & Recency
  let interviewAttempted = 0;
  let interviewSelected = 0;
  let weightedInterviewAttempted = 0;
  let weightedInterviewSelected = 0;

  applications.forEach((app) => {
    if (app.interview && (app.interview.status === "Completed" || app.interview.result !== "Pending")) {
      interviewAttempted++;
      const w = calculateRecencyWeight(app.interview.markedAt || app.updatedAt || app.createdAt);
      weightedInterviewAttempted += w;
      if (app.interview.result === "Selected") {
        interviewSelected++;
        weightedInterviewSelected += w;
      }
    }
  });

  // Prior: 55% baseline, prior weight: 2 attempts
  const interviewScore = calculateBayesianRate(weightedInterviewSelected, weightedInterviewAttempted, 0.55, 2.0);

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

  // Compute final PRA Score using Weighted Geometric Mean
  const subScores = {
    cgpa: cgpaScore,
    aiMatch: aiMatchScore,
    aptitude: aptitudeScore,
    gd: gdScore,
    interview: interviewScore,
    resume: resumeScore,
  };

  const praScore = calculateGeometricPRA(subScores, backlogPenalty);

  // Category
  let praCategory = "Needs Significant Improvement";
  if (praScore >= 75) {
    praCategory = "Well Prepared";
  } else if (praScore >= 45) {
    praCategory = "Needs Improvement";
  }

  // Tier 1: Prescriptive "What-If" Simulation Actions
  const whatIfActions = [];

  // Action 1: Mock Aptitude
  const simApt = calculateBayesianRate(weightedAptPassed + 1, weightedAptAttempted + 1, 0.60, 2.0);
  const simPraApt = calculateGeometricPRA({ ...subScores, aptitude: simApt }, backlogPenalty);
  const aptDelta = Math.max(1, simPraApt - praScore);
  whatIfActions.push({
    id: "mock_aptitude",
    title: "Clear 1 Mock Aptitude Test",
    category: "Aptitude",
    icon: "calculate",
    currentVal: subScores.aptitude,
    projectedVal: simApt,
    scoreDelta: aptDelta,
    description: "Take a timed quantitative and logical mock assessment to boost your screening rate."
  });

  // Action 2: Mock GD
  const simGd = calculateBayesianRate(weightedGdShortlisted + 1, weightedGdAttempted + 1, 0.60, 2.0);
  const simPraGd = calculateGeometricPRA({ ...subScores, gd: simGd }, backlogPenalty);
  const gdDelta = Math.max(1, simPraGd - praScore);
  whatIfActions.push({
    id: "mock_gd",
    title: "Clear 1 Mock Group Discussion",
    category: "Communication",
    icon: "forum",
    currentVal: subScores.gd,
    projectedVal: simGd,
    scoreDelta: gdDelta,
    description: "Participate in a placement cell peer GD to enhance your articulation and debate scores."
  });

  // Action 3: Mock Interview
  const simInterview = calculateBayesianRate(weightedInterviewSelected + 1, weightedInterviewAttempted + 1, 0.55, 2.0);
  const simPraInterview = calculateGeometricPRA({ ...subScores, interview: simInterview }, backlogPenalty);
  const interviewDelta = Math.max(1, simPraInterview - praScore);
  whatIfActions.push({
    id: "mock_interview",
    title: "Complete 1 Technical Mock Interview",
    category: "Technical Interview",
    icon: "groups",
    currentVal: subScores.interview,
    projectedVal: simInterview,
    scoreDelta: interviewDelta,
    description: "Conduct a peer or mentor mock interview focusing on system design, DSA, and project defense."
  });

  // Action 4: Resume Optimization
  if (!hasResume) {
    const simPraResume = calculateGeometricPRA({ ...subScores, resume: 100, aiMatch: Math.max(subScores.aiMatch, 75) }, backlogPenalty);
    const resumeGain = Math.max(4, simPraResume - praScore);
    whatIfActions.push({
      id: "upload_resume",
      title: "Upload ATS-Verified Resume",
      category: "Resume & ATS",
      icon: "description",
      currentVal: subScores.resume,
      projectedVal: 100,
      scoreDelta: resumeGain,
      description: "Upload your formatted PDF resume to unlock algorithmic shortlisting and keyword matching."
    });
  } else if (subScores.aiMatch < 75) {
    const simPraMatch = calculateGeometricPRA({ ...subScores, aiMatch: 80 }, backlogPenalty);
    const matchGain = Math.max(2, simPraMatch - praScore);
    whatIfActions.push({
      id: "optimize_keywords",
      title: "Align Resume to Job Descriptions",
      category: "Resume & ATS",
      icon: "psychology",
      currentVal: subScores.aiMatch,
      projectedVal: 80,
      scoreDelta: matchGain,
      description: "Incorporate missing tech stack keywords into your projects section to raise ATS score."
    });
  }

  // Action 5: Clear Active Backlog
  if ((student.activeBacklogs || 0) > 0) {
    const simPraBacklog = calculateGeometricPRA(subScores, Math.min(20, Math.max(0, (student.activeBacklogs - 1) * 5)));
    const backlogGain = Math.max(1, simPraBacklog - praScore);
    whatIfActions.push({
      id: "clear_backlog",
      title: "Clear 1 Active Academic Backlog",
      category: "Academics",
      icon: "school",
      currentVal: student.activeBacklogs,
      projectedVal: student.activeBacklogs - 1,
      scoreDelta: backlogGain,
      description: "Passing your backlog subject removes the institutional 5-point eligibility penalty."
    });
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

  // Aggregate recurring skill gaps from XAI using normalized extraction
  const skillGapFrequency = {};
  const positiveSentencesPool = [];
  applications.forEach((app) => {
    if (app.xai?.skillGaps && Array.isArray(app.xai.skillGaps)) {
      const cleanList = extractCleanSkills(app.xai.skillGaps);
      cleanList.forEach((skill) => {
        skillGapFrequency[skill] = (skillGapFrequency[skill] || 0) + 1;
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

  // Return only real gaps discovered during actual drive evaluations
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

  // 4. Aptitude (smooth prior baseline if unattempted)
  let aptVal = Math.min(10, Math.max(1, Math.round((subScores.aptitude / 10) * 10) / 10));

  // 5. Communication (smooth prior baseline if unattempted)
  let commVal = Math.min(10, Math.max(1, Math.round((subScores.gd / 10) * 10) / 10));

  // 6. Interview (smooth prior baseline if unattempted)
  let intVal = Math.min(10, Math.max(1, Math.round((subScores.interview / 10) * 10) / 10));

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
    isAptEstimated: aptAttempted === 0,
    gdAttempted,
    gdShortlisted,
    isGdEstimated: gdAttempted === 0,
    interviewAttempted,
    interviewSelected,
    isInterviewEstimated: interviewAttempted === 0,
    matchCount,
    isAiMatchEstimated: matchCount === 0,
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
    whatIfActions,
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
      const cleanList = extractCleanSkills(app.xai.skillGaps);
      cleanList.forEach((skill) => {
        missingSkillsMap[skill] = (missingSkillsMap[skill] || 0) + 1;
      });
    }
  });

  const placedCount = placedStudentSet.size;
  const placementPercentage = Math.round((placedCount / totalStudents) * 100);

  // Top 10 missing skills - derived from student application XAI evaluation data
  let topMissingSkills = Object.entries(missingSkillsMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalApplied > 0 ? Math.round((count / totalApplied) * 100) : 0,
    }));

  // Ensure full top 10 list is populated with real curriculum skills if dataset is small
  const defaultCurriculumSkills = [
    "Data Structures & Algorithms",
    "System Design & Microservices",
    "RESTful APIs & Web Services",
    "Git & Version Control",
    "SQL & Relational Databases",
    "Cloud Computing",
    "Docker Containerization",
    "Object-Oriented Programming (OOP)",
    "HTML5 / CSS / JavaScript",
    "Python"
  ];

  if (topMissingSkills.length < 10) {
    for (const core of defaultCurriculumSkills) {
      if (!topMissingSkills.some(s => s.name.toLowerCase() === core.toLowerCase())) {
        topMissingSkills.push({
          name: core,
          count: 1,
          percentage: totalApplied > 0 ? Math.round((1 / totalApplied) * 100) : 14,
        });
      }
      if (topMissingSkills.length >= 10) break;
    }
  }

  topMissingSkills = topMissingSkills.slice(0, 10);

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
          isEstimated: false,
        };
      } catch (err) {
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
          isEstimated: true,
          calculationError: err?.message || "Data calculation error",
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
  extractCleanSkills,
  calculateGeometricPRA,
};
