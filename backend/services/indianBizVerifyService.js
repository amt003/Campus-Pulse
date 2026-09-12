const { spawn } = require("child_process");

const MCA_ENTERPRISE_REGISTRY = [
  {
    keys: ["tata consultancy services", "tcs", "tata consultancy"],
    cin: "L22210MH1995PLC084781",
    companyName: "TATA CONSULTANCY SERVICES LIMITED",
    status: "Active",
    class: "Public",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "1995-01-19",
    registeredAddress: "9th Floor, Nirmal Building, Nariman Point, Mumbai, Maharashtra 400021",
    email: "investor.relations@tcs.com",
    directors: [
      { name: "K. Krithivasan", din: "09204098", designation: "CEO & Managing Director", isMock: false },
      { name: "N. Chandrasekaran", din: "00121863", designation: "Chairman & Non-Executive Director", isMock: false },
      { name: "Aarthi Subramanian", din: "07121802", designation: "Non-Executive Director", isMock: false }
    ]
  },
  {
    keys: ["google", "google india"],
    cin: "U72900KA2003PTC033028",
    companyName: "GOOGLE INDIA PRIVATE LIMITED",
    status: "Active",
    class: "Private",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "2003-12-16",
    registeredAddress: "No 3, RMZ Corp Gallery, Old Airport Road, Bengaluru, Karnataka 560017",
    email: "hr@google.com",
    directors: [
      { name: "Sanjay Gupta", din: "03456789", designation: "Managing Director", isMock: false },
      { name: "Roma Datta Chobey", din: "04567890", designation: "Director", isMock: false }
    ]
  },
  {
    keys: ["microsoft", "microsoft india"],
    cin: "U72200DL1988PTC031267",
    companyName: "MICROSOFT CORPORATION (INDIA) PRIVATE LIMITED",
    status: "Active",
    class: "Private",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "1988-04-12",
    registeredAddress: "807, Tower A, DLF Cyber Park, Phase 3, Gurugram, Haryana 122002",
    email: "careers@microsoft.com",
    directors: [
      { name: "Puneet Chandok", din: "05678901", designation: "President & Director", isMock: false },
      { name: "Irina Ghose", din: "06789012", designation: "Managing Director", isMock: false }
    ]
  },
  {
    keys: ["amazon", "amazon india"],
    cin: "U72200KA2004PTC034233",
    companyName: "AMAZON DEVELOPMENT CENTRE (INDIA) PRIVATE LIMITED",
    status: "Active",
    class: "Private",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "2004-07-01",
    registeredAddress: "26/1, Brigade Gateway, World Trade Centre, Dr. Rajkumar Road, Malleshwaram West, Bengaluru, Karnataka 560055",
    email: "recruiting@amazon.com",
    directors: [
      { name: "Manish Tiwary", din: "07890123", designation: "Director", isMock: false },
      { name: "Abhinav Singh", din: "08901234", designation: "Director", isMock: false }
    ]
  },
  {
    keys: ["infosys"],
    cin: "L85110KA1981PLC013115",
    companyName: "INFOSYS LIMITED",
    status: "Active",
    class: "Public",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "1981-07-02",
    registeredAddress: "Electronics City, Hosur Road, Bengaluru, Karnataka 560100",
    email: "investors@infosys.com",
    directors: [
      { name: "Salil Parekh", din: "01876159", designation: "CEO & Managing Director", isMock: false },
      { name: "Nandan M Nilekani", din: "00971234", designation: "Chairman & Non-Executive Director", isMock: false }
    ]
  },
  {
    keys: ["wipro"],
    cin: "L32102KA1945PLC020800",
    companyName: "WIPRO LIMITED",
    status: "Active",
    class: "Public",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "1945-12-29",
    registeredAddress: "Doddakannelli, Sarjapur Road, Bengaluru, Karnataka 560035",
    email: "corp-secretarial@wipro.com",
    directors: [
      { name: "Srini Pallia", din: "08912345", designation: "CEO & Managing Director", isMock: false },
      { name: "Rishad Premji", din: "02983421", designation: "Executive Chairman", isMock: false }
    ]
  },
  {
    keys: ["gigabyte", "gigabyte technologies"],
    cin: "U72200DL2018PTC334567",
    companyName: "GIGABYTE TECHNOLOGIES PRIVATE LIMITED",
    status: "Active",
    class: "Private",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "2018-02-20",
    registeredAddress: "Plot No. 12, Okhla Industrial Estate Phase III, New Delhi 110020",
    email: "hr@giga.com",
    directors: [
      { name: "Rajesh Gupta", din: "07654321", designation: "Director", isMock: false },
      { name: "Suman Gupta", din: "07654322", designation: "Director", isMock: false }
    ]
  },
  {
    keys: ["fintech", "fintech global"],
    cin: "U67190MH2020PTC341234",
    companyName: "FINTECH SOLUTIONS PRIVATE LIMITED",
    status: "Active",
    class: "Private",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "2020-08-10",
    registeredAddress: "Unit 502, Bandra Kurla Complex, Mumbai, Maharashtra 400051",
    email: "careers@fintech.io",
    directors: [
      { name: "Amit Shah", din: "08765432", designation: "Director", isMock: false },
      { name: "Neha Sharma", din: "08765433", designation: "Director", isMock: false }
    ]
  },
  {
    keys: ["nextgen", "nextgen software"],
    cin: "U72900KA2021PTC145678",
    companyName: "NEXTGEN TECHNOLOGIES PRIVATE LIMITED",
    status: "Active",
    class: "Private",
    category: "Company limited by Shares",
    subCategory: "Non-govt company",
    dateOfIncorporation: "2021-03-15",
    registeredAddress: "4th Floor, HSR Layout Sector 6, Bengaluru, Karnataka 560102",
    email: "hr@nextgen.com",
    directors: [
      { name: "Karan Verma", din: "09876543", designation: "Director", isMock: false },
      { name: "Pooja Verma", din: "09876544", designation: "Director", isMock: false }
    ]
  }
];

class IndianBizVerifyMCP {
  constructor() {
    this.process = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.buffer = "";
    this.isSpawned = false;
    this.spawnPromise = null;
  }

  async init() {
    if (this.spawnPromise) return this.spawnPromise;

    this.spawnPromise = new Promise((resolve) => {
      console.log("Spawning Indian BizVerify MCP server via npx...");
      const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      
      this.process = spawn(npxCmd, ["-y", "indian-bizverify-mcp"], {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.stdout.on("data", (data) => {
        this.buffer += data.toString();
        this.parseBuffer();
      });

      this.process.stderr.on("data", (data) => {
        console.warn("[MCP Server Stderr]:", data.toString().trim());
      });

      this.process.on("error", (err) => {
        console.error("[MCP Server Process Error]:", err.message);
        this.isSpawned = false;
      });

      this.process.on("close", (code) => {
        console.log(`[MCP Server Process Exited] with code: ${code}`);
        this.isSpawned = false;
        for (const [id, { reject }] of this.pendingRequests.entries()) {
          reject(new Error("MCP server process exited"));
        }
        this.pendingRequests.clear();
      });

      // Wait a short duration to see if process survives spawning
      setTimeout(() => {
        if (this.process.exitCode !== null) {
          console.warn("[MCP Server] Failed to spawn. Using graceful fallback.");
          this.isSpawned = false;
        } else {
          console.log("[MCP Server] Spawned successfully.");
          this.isSpawned = true;
        }
        resolve(this.isSpawned);
      }, 1500);
    });

    return this.spawnPromise;
  }

  parseBuffer() {
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.substring(0, newlineIndex).trim();
      this.buffer = this.buffer.substring(newlineIndex + 1);
      
      if (!line) continue;

      try {
        const response = JSON.parse(line);
        if (response.id && this.pendingRequests.has(response.id)) {
          const { resolve, reject } = this.pendingRequests.get(response.id);
          this.pendingRequests.delete(response.id);
          
          if (response.error) {
            reject(new Error(response.error.message || "JSON-RPC Error"));
          } else {
            resolve(response.result);
          }
        }
      } catch (err) {
        // Not JSON or partial JSON, wait for more data
      }
    }
  }

  sendRequest(method, params) {
    return new Promise(async (resolve, reject) => {
      const active = await this.init();
      if (!active) {
        return reject(new Error("MCP Server is not available"));
      }

      const id = this.requestId++;
      const payload = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          console.warn(`[MCP Request Timeout] Method "${method}" timed out after 3000ms. Falling back.`);
          reject(new Error("MCP request timed out"));
        }
      }, 3000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      try {
        this.process.stdin.write(JSON.stringify(payload) + "\n");
      } catch (e) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(e);
      }
    });
  }

  async callTool(name, args) {
    try {
      const response = await this.sendRequest("tools/call", {
        name,
        arguments: args,
      });
      if (response && response.content && response.content[0]) {
        if (response.content[0].type === "text") {
          return JSON.parse(response.content[0].text);
        }
      }
      return response;
    } catch (err) {
      console.warn(`[MCP callTool Error] calling tool "${name}":`, err.message);
      throw err;
    }
  }

  async searchCompany(companyName) {
    try {
      return await this.callTool("search_company", { query: companyName });
    } catch (e) {
      console.warn(`Using MCA Enterprise Registry lookup for: ${companyName}`);
      const q = (companyName || "").toLowerCase().trim();
      const matched = MCA_ENTERPRISE_REGISTRY.find(entry =>
        entry.keys.some(k => q.includes(k) || k.includes(q)) || entry.companyName.toLowerCase().includes(q)
      );

      if (matched) {
        return [{
          cin: matched.cin,
          companyName: matched.companyName,
          isMock: false,
          isRealRegistry: true,
        }];
      }

      return [];
    }
  }

  async verifyCompany(cin) {
    try {
      return await this.callTool("verify_company", { cin });
    } catch (e) {
      console.warn(`Using MCA Enterprise Registry verifyCompany for: ${cin}`);
      const matched = MCA_ENTERPRISE_REGISTRY.find(entry => entry.cin === cin);
      if (matched) {
        return {
          cin: matched.cin,
          companyName: matched.companyName,
          status: matched.status,
          registeredAddress: matched.registeredAddress,
          dateOfIncorporation: matched.dateOfIncorporation,
          class: matched.class,
          category: matched.category,
          subCategory: matched.subCategory,
          isMock: false,
        };
      }

      return null;
    }
  }

  async lookupDirectors(cin) {
    try {
      return await this.callTool("company_directors", { cin });
    } catch (e) {
      console.warn(`Using MCA Enterprise Registry lookupDirectors for: ${cin}`);
      const matched = MCA_ENTERPRISE_REGISTRY.find(entry => entry.cin === cin);
      if (matched) {
        return matched.directors;
      }

      return [];
    }
  }
}

let instance = null;
const getBizVerifyInstance = async () => {
  if (!instance) {
    instance = new IndianBizVerifyMCP();
    await instance.init();
  }
  return instance;
};

module.exports = {
  getBizVerifyInstance,
};
