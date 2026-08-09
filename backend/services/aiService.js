const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PDFParse } = require("pdf-parse");

/**
 * Parses a student resume PDF and calls the Sentence-BERT Flask microservice
 * to calculate semantic similarity against a job drive description.
 * 
 * @param {string} resumePath - Virtual path to the resume PDF on disk (e.g. /uploads/resumes/...)
 * @param {string} jobDescription - Plain text job description of the target drive
 * @returns {Object} { matchScore, feedback, success }
 */
const scoreResume = async (resumePath, jobDescription) => {
  try {
    // 1. Resolve absolute path to PDF
    const absolutePath = path.join(__dirname, "..", resumePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`[AI Service] Resume file not found at path: ${absolutePath}`);
      return {
        matchScore: 65.0,
        feedback: ["Warning: Resume file not found on disk. Falling back to default baseline score."],
        success: false
      };
    }

    // 2. Read and parse the PDF
    const dataBuffer = fs.readFileSync(absolutePath);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    const resumeText = pdfData.text || "";

    if (!resumeText.trim()) {
      console.warn(`[AI Service] Resume PDF text extraction returned empty content.`);
      return {
        matchScore: 60.0,
        feedback: ["Warning: Resume content could not be read (empty PDF). Falling back to default baseline score."],
        success: false
      };
    }

    // 3. Make POST request to Flask Sentence-BERT Microservice
    console.log(`[AI Service] Sending resume text to Sentence-BERT microservice on port 5001...`);
    const flaskResponse = await axios.post("http://localhost:5001/api/score-resume", {
      resumeText: resumeText,
      jobDescriptionText: jobDescription
    }, {
      timeout: 15000 // 15s timeout
    });

    if (flaskResponse.data && flaskResponse.data.success) {
      return {
        matchScore: flaskResponse.data.matchScore,
        positiveSentences: flaskResponse.data.positiveSentences || [],
        negativeSentences: flaskResponse.data.negativeSentences || [],
        skillGaps: flaskResponse.data.skillGaps || [],
        strongSkills: flaskResponse.data.strongSkills || [],
        success: true
      };
    } else {
      throw new Error(flaskResponse.data.message || "Failed to score resume via Flask");
    }

  } catch (error) {
    console.error("[AI Service] Error scoring resume (Python service Port 5001 offline/error):", error.message);
    
    // Fallback simulated matching logic based on simple parameters
    const baseline = 70.0;
    return {
      matchScore: baseline,
      positiveSentences: [
        "Candidate profile registered with baseline match.",
        "Sentence-BERT AI microservice (Port 5001) was offline during evaluation."
      ],
      negativeSentences: [],
      skillGaps: [],
      success: false,
      isOfflineFallback: true
    };
  }
};

module.exports = {
  scoreResume
};
