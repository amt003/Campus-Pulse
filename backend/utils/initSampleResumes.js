const fs = require("fs");
const path = require("path");

function getSamplePdfBuffer(studentName = "CampusPulse Student", rollNumber = "2024CS001", branch = "CSE") {
  const contentText = `
BT
/F1 22 Tf
50 720 Td
(${studentName} - Resume) Tj
/F1 12 Tf
0 -35 Td
(Roll Number: ${rollNumber} | Branch: ${branch}) Tj
0 -25 Td
(CampusPulse Student Profile Document) Tj
0 -40 Td
(SUMMARY) Tj
0 -20 Td
(Motivated student with strong problem-solving skills and technical foundation.) Tj
0 -35 Td
(EDUCATION) Tj
0 -20 Td
(Bachelor of Technology in ${branch} - CGPA: 8.5 / 10.0) Tj
0 -35 Td
(TECHNICAL SKILLS) Tj
0 -20 Td
(Languages: JavaScript, TypeScript, Python, Java, C++) Tj
0 -20 Td
(Frameworks & Web: Node.js, Express, Angular, HTML5, CSS3, MongoDB, SQL) Tj
0 -35 Td
(PROJECTS) Tj
0 -20 Td
(CampusPulse Placement Portal - Training & Placement Office Management System) Tj
ET`;

  const streamLength = Buffer.byteLength(contentText, "utf8");

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream${contentText}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000251 00000 n 
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`;

  return Buffer.from(pdfString);
}

function ensureSampleResumesExist() {
  const resumesDir = path.join(__dirname, "..", "uploads", "resumes");
  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }

  const defaultPdfPath = path.join(resumesDir, "default_resume.pdf");
  if (!fs.existsSync(defaultPdfPath)) {
    fs.writeFileSync(defaultPdfPath, getSamplePdfBuffer("CampusPulse Student", "CS2026", "Computer Science"));
    console.log("Created default_resume.pdf");
  }

  // Common seeded filenames to ensure they exist on disk
  const seededFiles = [
    { filename: "1787029006983-213052965-Ananya_Pillai_Resume.pdf", name: "Ananya Pillai", roll: "2021IT101", branch: "IT" },
    { filename: "1786000398672-20158771-Rahul_Sharma_Resume.pdf", name: "Rahul Sharma", roll: "2021CS101", branch: "CSE" },
    { filename: "1786684503308-602735176-Kavya_Menon_ATS_Software_Engineer_Resume.pdf", name: "Kavya Menon", roll: "2021IT103", branch: "IT" },
    { filename: "1785560421351-604294292-ABEY_MATHEW_Resume_removed.pdf", name: "Abey Mathew", roll: "2021CS127", branch: "CSE" }
  ];

  for (const sf of seededFiles) {
    const filePath = path.join(resumesDir, sf.filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, getSamplePdfBuffer(sf.name, sf.roll, sf.branch));
      console.log(`Created seeded resume file: ${sf.filename}`);
    }
  }
}

module.exports = {
  getSamplePdfBuffer,
  ensureSampleResumesExist,
};
