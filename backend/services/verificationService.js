// whoiser is an ESM package; require() gives us the named exports object
const whoiserPkg = require("whoiser");
// Support both whoiser.default() (ESM interop) and whoiser.whoisDomain()
const whoiserFn = whoiserPkg.default || whoiserPkg.whoisDomain || whoiserPkg;
const { URL } = require("url");
const { getBizVerifyInstance } = require("./indianBizVerifyService");

/**
 * Clean Domain Extractor
 */
const extractDomain = (websiteUrl, officialEmail) => {
  if (websiteUrl) {
    try {
      let urlString = websiteUrl.trim();
      if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
        urlString = "https://" + urlString;
      }
      const parsed = new URL(urlString);
      let hostname = parsed.hostname.toLowerCase();
      if (hostname.startsWith("www.")) {
        hostname = hostname.substring(4);
      }
      return hostname;
    } catch (e) {}
  }

  if (officialEmail && officialEmail.includes("@")) {
    return officialEmail.split("@")[1].toLowerCase();
  }

  return "company.com";
};

/**
 * WHOIS Domain Age & Metadata Lookup
 */
const verifyDomainWHOIS = async (websiteUrl, officialEmail) => {
  const domain = extractDomain(websiteUrl, officialEmail);

  try {
    const whoisPromise = whoiserPkg.whoisDomain(domain);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("WHOIS timeout")), 5000)
    );

    const whoisResult = await Promise.race([whoisPromise, timeoutPromise]);
    const domainData = whoisResult[Object.keys(whoisResult)[0]] || {};

    let creationDate = domainData["Created Date"] || domainData["Creation Date"] || domainData["created"] || null;
    if (Array.isArray(creationDate)) creationDate = creationDate[0];

    let domainAgeYears = null;
    if (creationDate) {
      const createdYear = new Date(creationDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (!isNaN(createdYear)) domainAgeYears = Math.max(1, currentYear - createdYear);
    }

    const registrar = domainData["Registrar"] || domainData["Sponsoring Registrar"] || "Verify on WHOIS";
    const registrantCountry = domainData["Registrant Country"] || domainData["Country"] || "N/A";

    return {
      domain,
      creationDate: creationDate ? new Date(creationDate).toISOString().split("T")[0] : "Verify on WHOIS",
      domainAgeYears: domainAgeYears,
      registrar: typeof registrar === "string" ? registrar : "Verify on WHOIS",
      registrantCountry: typeof registrantCountry === "string" ? registrantCountry : "N/A",
      isValid: true,
    };
  } catch (error) {
    return {
      domain: domain || "company.com",
      creationDate: "Verify on WHOIS",
      domainAgeYears: null,
      registrar: "Verify on WHOIS",
      registrantCountry: "N/A",
      isValid: true,
    };
  }
};

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "zoho.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
  "gmx.com",
  "live.com"
]);

/**
 * Composite Trust Score Calculation Engine (0 - 100)
 * Evaluates WHOIS Domain Verification (50 pts) & Email Domain Match (50 pts)
 */
const getMCAScore = async (companyName) => {
  try {
    const bizVerify = await getBizVerifyInstance();
    const results = await bizVerify.searchCompany(companyName);
    if (results && results.length > 0 && results[0].cin) {
      const cin = results[0].cin;
      const isSearchMock = results[0].isMock === true;

      const details = await bizVerify.verifyCompany(cin);
      const isDetailsMock = details.isMock === true;

      let directors = [];
      try {
        directors = await bizVerify.lookupDirectors(cin);
      } catch (dirErr) {
        console.warn("MCA directors lookup failed (non-blocking):", dirErr.message);
      }
      
      const isMock = isSearchMock || isDetailsMock;

      if (details && (details.status === "Active" || details.status === "APPROVED")) {
        return {
          found: true,
          cin: cin,
          status: details.status,
          score: details.isMock ? 0 : 30,
          mcaData: details,
          directors: directors,
        };
      }
    }
    return { found: false, score: 0, mcaData: null, directors: [] };
  } catch (error) {
    console.warn("MCA verification failed (non-blocking):", error.message);
    return { found: false, score: 0, mcaData: null, directors: [] };
  }
};

/**
 * Composite Trust Score Calculation Engine (0 - 100)
 * Evaluates WHOIS Domain Verification (50 pts) & Email Domain Match (50 pts)
 */
const calculateTrustScore = async ({ website, officialEmail, companyName }) => {
  const emailDomain = officialEmail ? officialEmail.split("@")[1]?.toLowerCase() : null;
  const isEmailFree = emailDomain ? FREE_EMAIL_DOMAINS.has(emailDomain) : false;

  const whoisData = await verifyDomainWHOIS(website, officialEmail);
  
  let domainAgeScore = 20;
  if (whoisData.domainAgeYears) {
    if (whoisData.domainAgeYears >= 10) domainAgeScore = 40;
    else if (whoisData.domainAgeYears >= 3) domainAgeScore = 30;
    else domainAgeScore = 20;
  }

  let emailMatchScore = 10;
  if (officialEmail && whoisData.domain) {
    const emailDomain = officialEmail.split("@")[1]?.toLowerCase();
    if (emailDomain && (emailDomain === whoisData.domain || whoisData.domain.includes(emailDomain))) {
      emailMatchScore = 30;
    }
  }

  // CAVEAT FOR FREE/PUBLIC PROVIDERS:
  // 1. If email is from a free provider, they do not get matching domain points
  if (isEmailFree) {
    emailMatchScore = 0;
  }

  // 2. If they registered using a free email and didn't provide a corporate website, they don't get the free domain age points
  if (!website && isEmailFree) {
    domainAgeScore = 0;
  }

  // 3. If they enter a free email domain as their website, penalize it
  if (website) {
    const websiteDomain = extractDomain(website, null);
    if (FREE_EMAIL_DOMAINS.has(websiteDomain)) {
      domainAgeScore = 0;
    }
  }

  const existingTotal = domainAgeScore + emailMatchScore;

  // MCA Verification Integration (max 30 points)
  let mcaScore = 0;
  let mcaData = null;
  let directors = [];

  if (companyName) {
    const mcaResult = await getMCAScore(companyName);
    if (mcaResult.found) {
      mcaScore = 30; // 30 points out of 100
      mcaData = mcaResult.mcaData;
      directors = mcaResult.directors;
    }
  }

  const totalScore = Math.min(100, existingTotal + mcaScore);

  return {
    trustScore: totalScore,
    breakdown: {
      domainAge: domainAgeScore,
      emailMatch: emailMatchScore,
      mca: mcaScore,
    },
    whoisData,
    mcaData,
    directors,
    verifiedAt: new Date(),
  };
};

module.exports = {
  verifyDomainWHOIS,
  calculateTrustScore,
  getMCAScore,
};
