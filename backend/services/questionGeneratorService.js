const { GoogleGenerativeAI } = require("@google/generative-ai");
const QuestionBank = require("../models/QuestionBank");

// Curated question templates for offline fallback when GEMINI_API_KEY is not configured
const FALLBACK_QUESTION_TEMPLATES = {
  Quantitative: [
    {
      questionText: "If the ratio of the areas of two squares is 9:16, what is the ratio of their perimeters?",
      options: ["3:4", "9:16", "1:2", "27:64"],
      correctOption: 0,
    },
    {
      questionText: "A train running at 72 km/h crosses a 200 m long platform in 22 seconds. What is the length of the train?",
      options: ["240 m", "220 m", "200 m", "180 m"],
      correctOption: 0,
    },
    {
      questionText: "A sum of money doubles itself in 5 years at simple interest. In how many years will it become 4 times itself?",
      options: ["10 years", "12 years", "15 years", "20 years"],
      correctOption: 2,
    },
    {
      questionText: "Pipe A can fill a tank in 4 hours, and Pipe B can empty it in 6 hours. If both are opened together, how long will it take to fill?",
      options: ["10 hours", "12 hours", "8 hours", "15 hours"],
      correctOption: 1,
    },
    {
      questionText: "A shopkeeper marks an item 20% above cost price and offers a 10% discount. What is his profit percentage?",
      options: ["8%", "10%", "12%", "6%"],
      correctOption: 0,
    },
    {
      questionText: "What is the probability of getting a sum of 7 when two standard six-sided dice are rolled simultaneously?",
      options: ["1/12", "1/6", "5/36", "7/36"],
      correctOption: 1,
    },
  ],
  Logical: [
    {
      questionText: "Find the next term in the series: 3, 7, 15, 31, 63, ?",
      options: ["125", "127", "129", "131"],
      correctOption: 1,
    },
    {
      questionText: "Pointing to a photograph, a man says: 'She is the daughter of my grandfather's only son.' How is she related to the man?",
      options: ["Mother", "Sister", "Aunt", "Daughter"],
      correctOption: 1,
    },
    {
      questionText: "If CLOCK is coded as KCOLC, how is WATCH coded in the same pattern?",
      options: ["HTACW", "HCTAW", "TACHW", "HCATW"],
      correctOption: 0,
    },
    {
      questionText: "All roses are flowers. Some flowers fade quickly. Which conclusion definitely follows?",
      options: [
        "All roses fade quickly",
        "Some roses may fade quickly",
        "No roses fade quickly",
        "Flowers never fade",
      ],
      correctOption: 1,
    },
    {
      questionText: "A is to the East of B and North of C. If M is to the South of C, in which direction is A with respect to M?",
      options: ["North-East", "South-West", "North-West", "South-East"],
      correctOption: 0,
    },
  ],
  Verbal: [
    {
      questionText: "Select the word most nearly OPPOSITE in meaning to 'METICULOUS':",
      options: ["Careless", "Thorough", "Detailed", "Scrupulous"],
      correctOption: 0,
    },
    {
      questionText: "Choose the correct preposition: She is proficient _____ French and Spanish.",
      options: ["at", "in", "with", "for"],
      correctOption: 1,
    },
    {
      questionText: "Identify the correctly spelled word:",
      options: ["Accommodate", "Acommodate", "Accomodate", "Acomodate"],
      correctOption: 0,
    },
    {
      questionText: "Choose the synonym for 'EPHEMERAL':",
      options: ["Transient", "Permanent", "Eternal", "Prolonged"],
      correctOption: 0,
    },
    {
      questionText: "Complete the sentence: Neither the manager nor the employees _____ present at the meeting.",
      options: ["was", "were", "is", "be"],
      correctOption: 1,
    },
  ],
  Technical: [
    {
      questionText: "What is the worst-case time complexity of QuickSort with standard lomuto partition?",
      options: ["O(N log N)", "O(N^2)", "O(log N)", "O(N)"],
      correctOption: 1,
    },
    {
      questionText: "Which HTTP status code signifies that a resource has been permanently moved to a new URI?",
      options: ["301", "302", "307", "308"],
      correctOption: 0,
    },
    {
      questionText: "In relational databases, which normal form ensures that no non-prime attribute is transitively dependent on the primary key?",
      options: ["1NF", "2NF", "3NF", "BCNF"],
      correctOption: 2,
    },
    {
      questionText: "Which data structure uses LIFO (Last-In, First-Out) principle?",
      options: ["Queue", "Stack", "Binary Search Tree", "Linked List"],
      correctOption: 1,
    },
    {
      questionText: "What will `typeof NaN` evaluate to in JavaScript?",
      options: ["'number'", "'nan'", "'undefined'", "'object'"],
      correctOption: 0,
    },
  ],
};

/**
 * Calls Gemini 1.5 Flash to generate questions in strict JSON format.
 */
const callGeminiAPI = async ({ count, category, difficulty, apiKey }) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  const prompt = `You are an expert exam question generator for campus recruitment tests.
Generate exactly ${count} multiple choice questions.
Category: ${category}
Difficulty: ${difficulty}

You must return a valid JSON array of question objects adhering to this schema:
[
  {
    "questionText": "Question statement string",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOption": 0
  }
]

Constraints:
- "options" must contain exactly 4 unique choices.
- "correctOption" must be an integer index from 0 to 3 corresponding to the correct answer.
- "questionText" must be unambiguous and clear.
- Return ONLY the JSON array, no commentary, markdown or extra text.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text().trim();

  // Strip code fences if present
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  let parsed = JSON.parse(text);
  if (!Array.isArray(parsed) && parsed.questions && Array.isArray(parsed.questions)) {
    parsed = parsed.questions;
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini response is not a valid JSON array");
  }

  return parsed;
};

/**
 * Generate questions using Gemini 1.5 Flash with fallback support.
 * Saves questions as draft with source 'ai_generated'.
 *
 * @param {Object} params
 * @param {number} params.count - Number of questions requested (default 5)
 * @param {string} params.category - Quantitative, Logical, Verbal, Technical
 * @param {string} params.difficulty - Easy, Medium, Hard
 * @param {string|ObjectId} params.recruiterId - Logged-in recruiter ID
 * @param {string} [params.apiKey] - Optional custom key override (for testing error simulation)
 * @returns {Promise<Array>} Array of saved QuestionBank documents
 */
const generateQuestions = async ({
  count = 5,
  category = "Quantitative",
  difficulty = "Easy",
  recruiterId,
  apiKey: customApiKey,
}) => {
  const validCategories = ["Quantitative", "Logical", "Verbal", "Technical"];
  const matchedCategory =
    validCategories.find((c) => c.toLowerCase() === category.trim().toLowerCase()) ||
    "Quantitative";

  const validDifficulties = ["Easy", "Medium", "Hard"];
  const matchedDifficulty =
    validDifficulties.find((d) => d.toLowerCase() === difficulty.trim().toLowerCase()) ||
    "Easy";

  const numQuestions = Math.max(1, Math.min(parseInt(count, 10) || 5, 20));

  const apiKey = customApiKey !== undefined ? customApiKey : process.env.GEMINI_API_KEY;

  let rawQuestions = [];

  if (apiKey) {
    try {
      rawQuestions = await callGeminiAPI({
        count: numQuestions,
        category: matchedCategory,
        difficulty: matchedDifficulty,
        apiKey,
      });
    } catch (apiError) {
      console.error("[QuestionGenerator] Gemini API call failed:", apiError.message);
      throw new Error(`Gemini AI question generation failed: ${apiError.message}`);
    }
  } else {
    // Graceful offline fallback: Use curated questions if GEMINI_API_KEY is not configured
    console.warn(
      "[QuestionGenerator] GEMINI_API_KEY not configured. Generating draft questions using offline curated AI bank."
    );
    const pool = FALLBACK_QUESTION_TEMPLATES[matchedCategory] || FALLBACK_QUESTION_TEMPLATES.Quantitative;
    for (let i = 0; i < numQuestions; i++) {
      const template = pool[i % pool.length];
      rawQuestions.push({
        questionText: `${template.questionText} (${matchedDifficulty} Q${i + 1})`,
        options: [...template.options],
        correctOption: template.correctOption,
      });
    }
  }

  // Validate and shape the questions
  const validatedDocs = [];
  for (const item of rawQuestions) {
    if (
      !item.questionText ||
      !Array.isArray(item.options) ||
      item.options.length !== 4 ||
      typeof item.correctOption !== "number" ||
      item.correctOption < 0 ||
      item.correctOption > 3
    ) {
      continue;
    }

    validatedDocs.push({
      recruiterId,
      questionText: String(item.questionText).trim(),
      options: item.options.map((opt) => String(opt).trim()),
      correctOption: item.correctOption,
      difficulty: matchedDifficulty,
      category: matchedCategory,
      source: "ai_generated",
      status: "draft",
      timesUsed: 0,
      createdAt: new Date(),
    });

    if (validatedDocs.length >= numQuestions) {
      break;
    }
  }

  if (validatedDocs.length === 0) {
    throw new Error("No valid questions could be extracted from AI response");
  }

  const savedQuestions = await QuestionBank.insertMany(validatedDocs);
  return savedQuestions;
};

module.exports = {
  generateQuestions,
  callGeminiAPI,
};
