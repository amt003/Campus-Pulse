# CampusPulse — AI-Powered Campus Placement Automation Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/Angular-19%2F21-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](#)

> **CampusPulse** is an intelligent, end-to-end campus recruitment ecosystem designed to streamline and automate placement drives for **Students**, **Placement Officers (TPO)**, and **Recruiters**. Powered by Sentence-BERT AI models, real-time WebSockets, and government business registry verifications, CampusPulse bridges the gap between campus talent and corporate opportunities.

---

## 📑 Table of Contents

- [Key Features & Role Portals](#-key-features--role-portals)
  - [1. Student Portal](#1-student-portal)
  - [2. TPO (Placement Cell) Executive Suite](#2-tpo-placement-cell-executive-suite)
  - [3. Recruiter Portal](#3-recruiter-portal)
- [System Architecture & AI Pipeline](#-system-architecture--ai-pipeline)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. AI Service Setup](#3-ai-service-setup)
  - [4. Frontend Setup](#4-frontend-setup)
- [Environment Variables](#-environment-variables)
- [Git Workflow & Branches](#-git-workflow--branches)
- [License & Acknowledgments](#-license--acknowledgments)

---

## 🌟 Key Features & Role Portals

### 1. Student Portal

- **AI Resume Matching & Gap Analysis:** Instant semantic scoring of uploaded resumes against active job descriptions using Sentence-BERT (`all-MiniLM-L6-v2`) with concrete recommendations and missing keyword detection.
- **Placement Readiness Engine:** Personalized preparation tracking across Aptitude, Coding, Group Discussions (GD), and Technical Interviews with dynamically curated course suggestions (Coursera, Udemy, LeetCode, freeCodeCamp).
- **Drive Discovery & Application Tracking:** Apply to eligible on-campus and virtual drives with policy-enforced checks (CGPA cutoff, backlogs, Tier offer limits).
- **Offer Central:** View, accept, and download digital offer letters upon selection.
- **Real-time Notifications:** Live interview alerts, drive status updates, and round-advancement notifications via Socket.io.

### 2. TPO (Placement Cell) Executive Suite

- **Executive Analytics Dashboard:** High-level overview of placement ratios, department-wise conversion rates, CTC salary bands, and active recruiter engagements.
- **Drive X-Ray & Pipeline Oversight:** End-to-end visual tracking of every recruitment drive across all stages (Aptitude, Tech Round 1/2, HR, Final Selects).
- **Recruiter Trust & MCA Verification Engine:** Multi-factor recruiter authentication combining WHOIS domain age checks and Indian MCA (Ministry of Corporate Affairs) business entity lookups.
- **College Configuration & Governance:** Customizable placement policies including dream offer thresholds, maximum allowed offers per student, and CGPA rounding rules.
- **Interactive Placement Calendar:** Centralized scheduler preventing scheduling conflicts between overlapping company drives.

### 3. Recruiter Portal

- **Drive & Job Posting Management:** Publish detailed recruitment drives with eligibility criteria, compensation breakdowns, and round definitions.
- **Smart Applicant Screening:** Filter applicants by AI resume match scores, CGPA, department, and skill compatibility.
- **Multi-Round Evaluation:** Move candidates across recruitment rounds with automated status updates.
- **Dynamic Offer Letter Generator:** Generate and issue official, styled PDF offer letters directly from the platform.

---

## 🧠 System Architecture & AI Pipeline

```
                       ┌─────────────────────────────────────┐
                       │        Angular 19/21 Client         │
                       │    (Student / TPO / Recruiter)      │
                       └──────────────────┬──────────────────┘
                                          │ HTTP / REST / WebSockets
                                          ▼
                       ┌─────────────────────────────────────┐
                       │        Node.js + Express API        │
                       │     - JWT Auth & Role Guards        │
                       │     - Socket.io Push Notifications  │
                       │     - Cron Schedulers & Email Svc   │
                       └───────────┬───────────────────┬─────┘
                                   │                   │
                  Mongoose / Query │                   │ Flask REST API
                                   ▼                   ▼
     ┌───────────────────────────────┐       ┌─────────────────────────────────┐
     │      MongoDB Database         │       │     Python AI Microservice      │
     │  - Students, Recruiters, TPOs │       │  - Sentence-BERT Embeddings     │
     │  - Drives, Applications       │       │  - Cosine Semantic Similarity   │
     │  - College Config & Policies  │       │  - Skill Extraction & Gap Score │
     └───────────────────────────────┘       └─────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer               | Technology                              | Description                                           |
| ------------------- | --------------------------------------- | ----------------------------------------------------- |
| **Frontend**        | Angular 19/21, TypeScript, RxJS         | Component-driven SPA architecture                     |
| **Styling & UI**    | CSS3 (Executive Design System), ECharts | Modern glassmorphism, responsive dashboards & charts  |
| **Backend API**     | Node.js, Express 5                      | RESTful services, middleware security, file streaming |
| **Database**        | MongoDB Atlas, Mongoose                 | NoSQL persistence with schemas & validations          |
| **Real-time**       | Socket.io                               | Bi-directional event broadcasting for live updates    |
| **AI Microservice** | Python 3, Flask, PyTorch                | Microservice exposing semantic NLP endpoints          |
| **NLP Model**       | `all-MiniLM-L6-v2` (Sentence-BERT)      | 384-dimensional dense semantic text embeddings        |
| **PDF & Reports**   | pdf-parse, jsPDF, html2canvas           | In-browser and server-side PDF generation/parsing     |
| **Verification**    | WHOIS Protocol, Indian BizVerify MCP    | Live domain age & MCA registry validation             |

---

## 📁 Project Directory Structure

```
Campus-Pulse/
├── Frontend/                 # Angular 19/21 Frontend Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # Shared widgets, navbars, modals & dialogs
│   │   │   ├── guards/      # Role-based route guards (Student, TPO, Recruiter)
│   │   │   ├── pages/       # Portal views (student/, tpo/, recruiter/, auth/)
│   │   │   ├── services/    # Angular HTTP data services & WebSocket clients
│   │   │   └── shared/      # Shared interfaces, pipes, and utilities
│   │   └── environments/    # Development & production environment configurations
│   └── angular.json         # Angular build & proxy configuration
│
├── Backend/                  # Node.js + Express Server
│   ├── config/              # MongoDB connection & configuration
│   ├── controllers/         # Request handlers (auth, student, recruiter, tpo)
│   ├── middleware/          # JWT authentication & role-verification guards
│   ├── models/              # Mongoose schemas (User, Student, Drive, Application, etc.)
│   ├── routes/              # Express API route declarations
│   ├── services/            # Placement analyzer, WHOIS/MCA verification, AI client
│   ├── utils/               # Cron schedulers, email dispatchers, sample seeders
│   └── server.js            # Express application bootstrap & Socket.io server
│
├── ai_service/               # Python NLP / Resume Match Microservice
│   ├── app.py               # Flask application with Sentence-BERT inference
│   └── requirements.txt     # Python dependencies (torch, sentence-transformers)
│
└── docs/                     # Project documentation, diagrams, and reports
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your machine:

- **Node.js** `>= 18.x` & **npm** `>= 9.x`
- **Python** `>= 3.10` & **pip**
- **MongoDB** (Local instance or MongoDB Atlas connection string)
- **Angular CLI** (`npm install -g @angular/cli`)

---

### 1. Clone Repository

```bash
git clone https://github.com/amt003/Campus-Pulse.git
cd Campus-Pulse
```

---

### 2. Backend Setup

```bash
cd Backend
npm install
```

Create a `.env` file in the `Backend/` directory:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/campuspulse
JWT_SECRET=your_super_secret_jwt_key_here
AI_SERVICE_URL=http://127.0.0.1:5001

# Optional Email Configuration (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# Optional Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Start the backend development server:

```bash
npm run dev
# Server will start on http://localhost:5000
```

---

### 3. AI Service Setup

Open a new terminal window:

```bash
cd ai_service

# Create and activate virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask AI microservice
python app.py
# AI microservice will start on http://localhost:5001
```

> **Note:** On first startup, the service will download the `all-MiniLM-L6-v2` Sentence-BERT weights (approx. 80MB).

---

### 4. Frontend Setup

Open a new terminal window:

```bash
cd Frontend
npm install

# Start the Angular development server
npm start
# Application will run on http://localhost:4200 (proxies /api requests to backend)
```

Visit **`http://localhost:4200`** in your browser.

---

## 🔐 Environment Variables

| Variable           | Description                               | Required | Default                 |
| ------------------ | ----------------------------------------- | :------: | ----------------------- |
| `PORT`             | Backend server port                       |    No    | `5000`                  |
| `MONGODB_URI`      | MongoDB Atlas / Local connection string   | **Yes**  | —                       |
| `JWT_SECRET`       | Secret token for signing JSON Web Tokens  | **Yes**  | —                       |
| `AI_SERVICE_URL`   | Endpoint for Python Sentence-BERT service |    No    | `http://127.0.0.1:5001` |
| `EMAIL_USER`       | SMTP username for automated emails        |    No    | `null`                  |
| `EMAIL_PASS`       | SMTP app password for automated emails    |    No    | `null`                  |
| `GOOGLE_CLIENT_ID` | Client ID for Google OAuth login          |    No    | `null`                  |

---

## 🌿 Git Workflow & Branches

| Branch             | Description                                                  | Status         |
| ------------------ | ------------------------------------------------------------ | -------------- |
| **`develop`**      | Active feature development, continuous integration & updates | Active         |
| **`mini-project`** | Evaluated, stable project submission baseline                | Stable Release |

---

## 📄Acknowledgments

This project is developed as an academic and institutional placement automation solution
