const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Extracts raw text from a PDF Buffer using pdf-parse with fallback handling
 */
const extractTextFromPdfBuffer = async (buffer) => {
  try {
    const pdfParseModule = require("pdf-parse");
    let text = "";

    if (typeof pdfParseModule === "function") {
      const parsed = await pdfParseModule(buffer);
      text = parsed.text || "";
    } else if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const parsed = await parser.getText();
      text = parsed.text || "";
    } else if (typeof pdfParseModule.default === "function") {
      const parsed = await pdfParseModule.default(buffer);
      text = parsed.text || "";
    } else {
      throw new Error("Unsupported pdf-parse export structure");
    }

    return text.trim();
  } catch (error) {
    console.error("[PDFExtractor] Error extracting text from PDF buffer:", error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

/**
 * Deterministic Rule-Based Question Parser for PDF text
 */
const parseQuestionsRuleBased = (rawText, defaultCategory = "Quantitative", defaultDifficulty = "Medium") => {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const validCategories = ["Quantitative", "Logical", "Verbal", "Technical"];
  const validDifficulties = ["Easy", "Medium", "Hard"];

  const cleanCategory = validCategories.find(
    (c) => c.toLowerCase() === (defaultCategory || "").trim().toLowerCase()
  ) || "Quantitative";

  const cleanDifficulty = validDifficulties.find(
    (d) => d.toLowerCase() === (defaultDifficulty || "").trim().toLowerCase()
  ) || "Medium";

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions = [];

  let currentQuestion = null;
  let currentOptions = [];
  let currentAnswer = null;

  const detectCategory = (text) => {
    const lower = text.toLowerCase();
    if (/function|complexity|binary|tree|array|sql|database|react|node|javascript|python|code|pointer|stack|queue|api|http|express|algorithm|sorting|compiler|oop|inheritance/i.test(lower)) {
      return "Technical";
    }
    if (/synonym|antonym|opposite|meaning|sentence|grammar|spelled|preposition|idiom|phrase|passive|active|punctuated|spelling|meticulous|vocabulary|conjunction/i.test(lower)) {
      return "Verbal";
    }
    if (/pointing|photograph|series|next term|conclusion|statement|direction|relation|brother|sister|father|mother|coded|pattern|syllogism|seating/i.test(lower)) {
      return "Logical";
    }
    if (/ratio|train|speed|km\/h|meter|cistern|pipes|interest|percent|profit|discount|perimeter|area|dice|probability|average|algebra|square|triangle/i.test(lower)) {
      return "Quantitative";
    }
    return cleanCategory;
  };

  const isMixedCategory = (defaultCategory || "").toLowerCase() === "mixed" || !defaultCategory;

  const saveCurrent = () => {
    if (currentQuestion && currentQuestion.trim()) {
      let finalOptions = [...currentOptions];
      
      // If we don't have 4 options, pad with meaningful defaults or split
      if (finalOptions.length < 4) {
        while (finalOptions.length < 4) {
          finalOptions.push(`Option ${String.fromCharCode(65 + finalOptions.length)}`);
        }
      } else if (finalOptions.length > 4) {
        finalOptions = finalOptions.slice(0, 4);
      }

      let correctIndex = 0;
      if (currentAnswer !== null && currentAnswer !== undefined) {
        if (typeof currentAnswer === "number" && currentAnswer >= 0 && currentAnswer < 4) {
          correctIndex = currentAnswer;
        } else if (typeof currentAnswer === "string") {
          const charCode = currentAnswer.trim().toUpperCase().charCodeAt(0);
          if (charCode >= 65 && charCode <= 68) {
            correctIndex = charCode - 65; // A->0, B->1, C->2, D->3
          } else if (/^[1-4]$/.test(currentAnswer.trim())) {
            correctIndex = parseInt(currentAnswer.trim(), 10) - 1;
          }
        }
      }

      const assignedCategory = isMixedCategory ? detectCategory(currentQuestion + " " + finalOptions.join(" ")) : cleanCategory;

      questions.push({
        questionText: currentQuestion.trim(),
        options: finalOptions.map((opt) => String(opt).trim()),
        correctOption: correctIndex,
        category: assignedCategory,
        difficulty: cleanDifficulty,
        source: "pdf_upload",
      });
    }
  };

  const questionRegex = /^(?:Q(?:uestion)?\s*\d+|\d+)[\.\:\)]\s*(.+)$/i;
  const optionRegex = /^(?:\(([A-D])\)|([A-D])[\.\:\)]|\b([A-D])\))\s*(.+)$/i;
  const answerRegex = /^(?:Answer|Ans|Correct\s*Option|Correct\s*Answer|Key)[\s\:\-\=]+(?:\(?([A-D1-4])\)?|([A-D1-4]))/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for answer declaration
    const ansMatch = line.match(answerRegex);
    if (ansMatch) {
      currentAnswer = ansMatch[1] || ansMatch[2];
      continue;
    }

    // Check for option declaration
    const optMatch = line.match(optionRegex);
    if (optMatch && currentQuestion) {
      const optLetter = optMatch[1] || optMatch[2] || optMatch[3];
      const optText = optMatch[4];
      if (optText && optText.trim()) {
        currentOptions.push(optText.trim());
      }
      continue;
    }

    // Check for question start
    const qMatch = line.match(questionRegex);
    if (qMatch) {
      saveCurrent();
      currentQuestion = qMatch[1];
      currentOptions = [];
      currentAnswer = null;
      continue;
    }

    // Append to existing statement or option if no direct prefix
    if (currentQuestion && currentOptions.length === 0) {
      currentQuestion += ` ${line}`;
    } else if (currentOptions.length > 0 && currentOptions.length <= 4) {
      currentOptions[currentOptions.length - 1] += ` ${line}`;
    }
  }

  // Save the trailing question
  saveCurrent();

  return questions;
};

/**
 * Extracts and structures questions from PDF text using Gemini AI or fallback
 */
const parseQuestionsFromPdf = async ({ buffer, defaultCategory = "Quantitative", defaultDifficulty = "Medium", apiKey }) => {
  // 1. Extract raw text from buffer
  const rawText = await extractTextFromPdfBuffer(buffer);

  if (!rawText || rawText.length < 15) {
    throw new Error("Extracted PDF content is empty or contains insufficient text.");
  }

  const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY;

  // 2. If Gemini API key is available, use LLM for high-accuracy extraction
  if (resolvedApiKey) {
    try {
      console.log("[PDFExtractor] Attempting AI-assisted extraction via Gemini...");
      const genAI = new GoogleGenerativeAI(resolvedApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an AI that extracts Multiple Choice Questions from documents.
Extract all multiple-choice questions from the following text accurately.

Rules:
1. Extract every MCQ question with its 4 options (A, B, C, D) and identify the correct option.
2. Return ONLY a valid JSON array of objects. Do not include markdown \`\`\`json or \`\`\` blocks, HTML, or explanations.
3. Each question object MUST have:
   - "questionText": string (clear question statement)
   - "options": array of exactly 4 strings (choice A, B, C, D without the leading "A)" or "B)")
   - "correctOption": integer 0, 1, 2, or 3 (0=A, 1=B, 2=C, 3=D). If answer key is not given in text, infer the correct answer.
   - "category": string, one of ["Quantitative", "Logical", "Verbal", "Technical"] (infer from content or use default "${defaultCategory}")
   - "difficulty": string, one of ["Easy", "Medium", "Hard"] (infer from content or use default "${defaultDifficulty}")

Input Document Text:
${rawText.slice(0, 15000)}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let textResponse = response.text().trim();

      // Clean markdown code fence if returned
      textResponse = textResponse.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

      const parsedArray = JSON.parse(textResponse);
      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        const validated = parsedArray.map((q) => {
          let opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
          while (opts.length < 4) {
            opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
          }
          if (opts.length > 4) opts = opts.slice(0, 4);

          let correctIdx = 0;
          if (typeof q.correctOption === "number" && q.correctOption >= 0 && q.correctOption <= 3) {
            correctIdx = q.correctOption;
          }

          const validCats = ["Quantitative", "Logical", "Verbal", "Technical"];
          const validDiffs = ["Easy", "Medium", "Hard"];

          return {
            questionText: String(q.questionText || "Question").trim(),
            options: opts,
            correctOption: correctIdx,
            category: validCats.includes(q.category) ? q.category : defaultCategory || "Quantitative",
            difficulty: validDiffs.includes(q.difficulty) ? q.difficulty : defaultDifficulty || "Medium",
            source: "pdf_upload",
          };
        });

        console.log(`[PDFExtractor] Gemini extracted ${validated.length} questions successfully.`);
        return validated;
      }
    } catch (aiError) {
      console.warn("[PDFExtractor] Gemini parsing failed or encountered error, falling back to rule-based parser:", aiError.message);
    }
  }

  // 3. Fallback to robust deterministic rule-based extractor
  console.log("[PDFExtractor] Parsing questions using deterministic rule-based extractor...");
  const ruleBasedQuestions = parseQuestionsRuleBased(rawText, defaultCategory, defaultDifficulty);

  if (!ruleBasedQuestions || ruleBasedQuestions.length === 0) {
    throw new Error(
      "Could not automatically detect standard MCQ patterns (e.g. 1. Question... A) Option 1, B) Option 2...) in the PDF. Please check the PDF formatting."
    );
  }

  return ruleBasedQuestions;
};

module.exports = {
  extractTextFromPdfBuffer,
  parseQuestionsRuleBased,
  parseQuestionsFromPdf,
};
