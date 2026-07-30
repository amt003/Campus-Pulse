const whoiser = require("whoiser");
const { URL } = require("url");

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
    const whoisPromise = whoiser(domain);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("WHOIS timeout")), 600)
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

/**
 * Composite Trust Score Calculation Engine (0 - 100)
 * Evaluates WHOIS Domain Verification (50 pts) & Email Domain Match (50 pts)
 */
const calculateTrustScore = async ({ website, officialEmail }) => {
  const whoisData = await verifyDomainWHOIS(website, officialEmail);
  
  let domainAgeScore = 30;
  if (whoisData.domainAgeYears) {
    if (whoisData.domainAgeYears >= 10) domainAgeScore = 50;
    else if (whoisData.domainAgeYears >= 3) domainAgeScore = 40;
    else domainAgeScore = 30;
  }

  let emailMatchScore = 15;
  if (officialEmail && whoisData.domain) {
    const emailDomain = officialEmail.split("@")[1]?.toLowerCase();
    if (emailDomain && (emailDomain === whoisData.domain || whoisData.domain.includes(emailDomain))) {
      emailMatchScore = 50;
    }
  }

  const totalScore = Math.min(100, domainAgeScore + emailMatchScore);

  return {
    trustScore: totalScore,
    breakdown: {
      domainAge: domainAgeScore,
      emailMatch: emailMatchScore,
    },
    whoisData,
    verifiedAt: new Date(),
  };
};

module.exports = {
  verifyDomainWHOIS,
  calculateTrustScore,
};
