/**
 * Learning Resource & Course Mapping Service
 * Provides curated, real-time platform links, free courses, certifications, and interactive tools for PRA suggestions.
 */

const SKILL_RESOURCES = {
  docker: [
    {
      title: "Docker for Beginners (Hands-on Project)",
      platform: "freeCodeCamp",
      url: "https://www.youtube.com/watch?v=fqMOX6JJhGo",
      type: "Free Course",
      badge: "Free"
    },
    {
      title: "Docker Official Get Started Interactive Guide",
      platform: "Docker Docs",
      url: "https://docs.docker.com/get-started/",
      type: "Official Docs",
      badge: "Official"
    }
  ],
  aws: [
    {
      title: "AWS Cloud Practitioner Essentials",
      platform: "AWS Skill Builder",
      url: "https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials",
      type: "Certification Prep",
      badge: "Official Free"
    },
    {
      title: "AWS Certified Solutions Architect Full Course",
      platform: "freeCodeCamp",
      url: "https://www.youtube.com/watch?v=SOTamWNgDKc",
      type: "Video Course",
      badge: "Free"
    }
  ],
  cloud: [
    {
      title: "Google Cloud Fundamentals: Core Infrastructure",
      platform: "Coursera",
      url: "https://www.coursera.org/learn/gcp-fundamentals",
      type: "Specialization (Audit)",
      badge: "Free Audit"
    },
    {
      title: "AWS Cloud Practitioner Essentials",
      platform: "AWS Skill Builder",
      url: "https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials",
      type: "Certification Prep",
      badge: "Official Free"
    }
  ],
  kubernetes: [
    {
      title: "Kubernetes Basics Interactive Tutorials",
      platform: "Kubernetes.io",
      url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/",
      type: "Interactive Lab",
      badge: "Official"
    },
    {
      title: "Kubernetes Crash Course for Full Stack Developers",
      platform: "freeCodeCamp",
      url: "https://www.youtube.com/watch?v=X48VuDVv0do",
      type: "Video Course",
      badge: "Free"
    }
  ],
  systemdesign: [
    {
      title: "System Design Primer & Architecture Blueprints",
      platform: "GitHub (Donne Martin)",
      url: "https://github.com/donnemartin/system-design-primer",
      type: "Study Guide",
      badge: "Top Rated"
    },
    {
      title: "ByteByteGo: System Design Interview Essentials",
      platform: "ByteByteGo",
      url: "https://bytebytego.com/",
      type: "Visual Guide",
      badge: "Recommended"
    }
  ],
  redis: [
    {
      title: "RU101: Introduction to Redis Data Structures",
      platform: "Redis University",
      url: "https://university.redis.com/courses/ru101/",
      type: "Official Course",
      badge: "Official Free"
    },
    {
      title: "Redis Crash Course for High-Performance Caching",
      platform: "freeCodeCamp",
      url: "https://www.youtube.com/watch?v=jgpVdJB2sKQ",
      type: "Video Course",
      badge: "Free"
    }
  ],
  react: [
    {
      title: "React Official Interactive Tutorial & Docs",
      platform: "React.dev",
      url: "https://react.dev/learn",
      type: "Interactive Docs",
      badge: "Official"
    },
    {
      title: "Full Stack Open (React, Redux, Node, GraphQL)",
      platform: "University of Helsinki",
      url: "https://fullstackopen.com/en/",
      type: "Accredited Course",
      badge: "Certificate"
    }
  ],
  node: [
    {
      title: "Node.js & Express RESTful API Development",
      platform: "MDN Web Docs",
      url: "https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs",
      type: "Interactive Guide",
      badge: "Official"
    },
    {
      title: "Node.js Backend Architecture & Microservices",
      platform: "freeCodeCamp",
      url: "https://www.youtube.com/watch?v=Oe421EPjeBE",
      type: "Free Course",
      badge: "Free"
    }
  ],
  angular: [
    {
      title: "Angular Official Essentials & Tour of Heroes",
      platform: "Angular.dev",
      url: "https://angular.dev/tutorials/learn-angular",
      type: "Interactive Tutorial",
      badge: "Official"
    }
  ],
  python: [
    {
      title: "Python for Everybody Specialization",
      platform: "University of Michigan (PY4E)",
      url: "https://www.py4e.com/",
      type: "Full Curriculum",
      badge: "Free"
    },
    {
      title: "CS50's Introduction to Programming with Python",
      platform: "Harvard edX",
      url: "https://cs50.harvard.edu/python/",
      type: "Accredited Course",
      badge: "Harvard Free"
    }
  ],
  java: [
    {
      title: "Java Programming MOOC (Parts I & II)",
      platform: "University of Helsinki",
      url: "https://java-programming.mooc.fi/",
      type: "Accredited Course",
      badge: "Top Rated"
    },
    {
      title: "Building a REST API with Spring Boot 3",
      platform: "Spring Academy",
      url: "https://spring.academy/courses/building-a-rest-api-with-spring-boot",
      type: "Official Course",
      badge: "Official"
    }
  ],
  spring: [
    {
      title: "Building a REST API with Spring Boot 3",
      platform: "Spring Academy",
      url: "https://spring.academy/courses/building-a-rest-api-with-spring-boot",
      type: "Official Course",
      badge: "Official"
    },
    {
      title: "Spring Boot Microservices Full Masterclass",
      platform: "freeCodeCamp",
      url: "https://www.youtube.com/watch?v=mSZTn4lMptg",
      type: "Video Course",
      badge: "Free"
    }
  ],
  sql: [
    {
      title: "SQLBolt: Interactive SQL Lessons & Queries",
      platform: "SQLBolt",
      url: "https://sqlbolt.com/",
      type: "Interactive Lab",
      badge: "Free"
    },
    {
      title: "Mode Analytics: Comprehensive SQL Tutorial",
      platform: "Mode Analytics",
      url: "https://mode.com/sql-tutorial/",
      type: "Industry Guide",
      badge: "Recommended"
    }
  ],
  mongodb: [
    {
      title: "M001: MongoDB Basics & Aggregation Framework",
      platform: "MongoDB University",
      url: "https://learn.mongodb.com/courses/m001-mongodb-basics",
      type: "Official Course",
      badge: "Official Free"
    }
  ],
  dsa: [
    {
      title: "Striver's A2Z DSA Course & Sheet",
      platform: "TakeUForward",
      url: "https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2",
      type: "Complete Track",
      badge: "Top Rated"
    },
    {
      title: "NeetCode 150 Interview Practice Roadmap",
      platform: "NeetCode.io",
      url: "https://neetcode.io/practice",
      type: "Practice Sheet",
      badge: "Interactive"
    },
    {
      title: "LeetCode Top Interview 150 Study Plan",
      platform: "LeetCode",
      url: "https://leetcode.com/studyplan/top-interview-150/",
      type: "Coding Challenge",
      badge: "Industry Standard"
    }
  ],
  devops: [
    {
      title: "GitLab CI/CD Fundamentals & Pipeline Setup",
      platform: "GitLab Docs",
      url: "https://docs.gitlab.com/ee/ci/",
      type: "Official Lab",
      badge: "Official"
    },
    {
      title: "GitHub Actions: Automated Testing & Continuous Delivery",
      platform: "GitHub Skills",
      url: "https://skills.github.com/",
      type: "Interactive Lab",
      badge: "Free"
    }
  ],
  git: [
    {
      title: "Pro Git Book (Complete Official Reference)",
      platform: "Git-SCM",
      url: "https://git-scm.com/book/en/v2",
      type: "Open Book",
      badge: "Official"
    },
    {
      title: "Interactive GitHub Learning Lab",
      platform: "GitHub Skills",
      url: "https://skills.github.com/",
      type: "Hands-on Lab",
      badge: "Free"
    }
  ]
};

const STAGE_RESOURCES = {
  aptitude: [
    {
      title: "IndiaBIX: Quantitative & Logical Reasoning Practice",
      platform: "IndiaBIX",
      url: "https://www.indiabix.com/aptitude/questions-and-answers/",
      type: "Practice Engine",
      badge: "Free"
    },
    {
      title: "PrepInsta: Company-Specific Placement Test Series",
      platform: "PrepInsta",
      url: "https://prepinsta.com/",
      type: "Mock Tests",
      badge: "Recommended"
    },
    {
      title: "GeeksforGeeks Aptitude Preparation Track",
      platform: "GeeksforGeeks",
      url: "https://www.geeksforgeeks.org/aptitude-questions-and-answers/",
      type: "Topic-wise Track",
      badge: "Free"
    }
  ],
  communication: [
    {
      title: "How to Excel in Group Discussions & Speaking",
      platform: "Harvard Business Review",
      url: "https://hbr.org/topic/subject/communication",
      type: "Editorial Guide",
      badge: "Top Rated"
    },
    {
      title: "Impromptu Speaking & Table Topics Frameworks",
      platform: "Toastmasters International",
      url: "https://www.toastmasters.org/resources/public-speaking-tips",
      type: "Public Speaking",
      badge: "Official"
    }
  ],
  interview: [
    {
      title: "Google Interview Warmup (AI Speech & Tech Mock)",
      platform: "Grow with Google",
      url: "https://grow.google/certificates/interview-warmup/",
      type: "AI Interactive Tool",
      badge: "AI-Powered Free"
    },
    {
      title: "Pramp: Free 1-on-1 Peer Live Technical Interviews",
      platform: "Pramp / Exponent",
      url: "https://www.pramp.com/",
      type: "Live Peer Mock",
      badge: "Free"
    },
    {
      title: "Tech Interview Handbook by Yangshun Tay",
      platform: "TechInterviewHandbook.org",
      url: "https://www.techinterviewhandbook.org/",
      type: "Curated Guide",
      badge: "Top Rated"
    }
  ],
  resume: [
    {
      title: "Harvard ATS Resume Templates & Action Verbs Guide",
      platform: "Harvard Career Services",
      url: "https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/",
      type: "Official PDF Templates",
      badge: "Harvard Free"
    },
    {
      title: "Overleaf: Modern LaTeX ATS Computer Science Resumes",
      platform: "Overleaf",
      url: "https://www.overleaf.com/gallery/tagged/cv",
      type: "LaTeX Templates",
      badge: "Free"
    }
  ],
  portfolio: [
    {
      title: "Full Stack Open: Deep Dive into Modern Web Development",
      platform: "University of Helsinki",
      url: "https://fullstackopen.com/en/",
      type: "Accredited Curriculum",
      badge: "Certificate Free"
    },
    {
      title: "The Odin Project: Complete Full Stack JavaScript Path",
      platform: "The Odin Project",
      url: "https://www.theodinproject.com/",
      type: "Hands-on Projects",
      badge: "Free"
    }
  ],
  placement_activity: [
    {
      title: "GeeksforGeeks Complete Campus Placement Prep Guide",
      platform: "GeeksforGeeks",
      url: "https://www.geeksforgeeks.org/campus-placement-preparation/",
      type: "Roadmap Guide",
      badge: "Free"
    },
    {
      title: "Striver's SDE Sheet & Core Interview Topics",
      platform: "TakeUForward",
      url: "https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems/",
      type: "Interview Sheet",
      badge: "Top Rated"
    }
  ]
};

/**
 * Lookup matching learning resources for a given category or skill keyword
 * @param {string} category - Suggestion category ('Aptitude', 'Communication', 'Technical Interview', 'Resume & ATS', 'Skill Gap', 'Placement Activity', 'Academics', etc.)
 * @param {string} [skillName] - Name of specific skill (e.g., 'Docker', 'AWS Cloud', 'Kubernetes')
 * @returns {Array<{ title: string, platform: string, url: string, type: string, badge?: string }>}
 */
function getResourcesForSuggestion(category, skillName = "") {
  // 1. If a specific skill name is provided (e.g. Skill Gap)
  if (skillName) {
    const cleaned = skillName.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [key, resources] of Object.entries(SKILL_RESOURCES)) {
      if (cleaned.includes(key) || key.includes(cleaned)) {
        return resources;
      }
    }
  }

  // 2. Map standard category strings
  const catLower = (category || "").toLowerCase();

  if (catLower.includes("aptitude") || catLower.includes("quant")) {
    return STAGE_RESOURCES.aptitude;
  }
  if (catLower.includes("communication") || catLower.includes("gd") || catLower.includes("group discussion")) {
    return STAGE_RESOURCES.communication;
  }
  if (catLower.includes("interview") || catLower.includes("technical interview")) {
    return STAGE_RESOURCES.interview;
  }
  if (catLower.includes("resume") || catLower.includes("ats")) {
    return STAGE_RESOURCES.resume;
  }
  if (catLower.includes("academic") || catLower.includes("portfolio") || catLower.includes("cgpa")) {
    return STAGE_RESOURCES.portfolio;
  }
  if (catLower.includes("placement activity") || catLower.includes("activity")) {
    return STAGE_RESOURCES.placement_activity;
  }

  // Default fallback to DSA / interview general
  return STAGE_RESOURCES.interview;
}

module.exports = {
  SKILL_RESOURCES,
  STAGE_RESOURCES,
  getResourcesForSuggestion,
};
