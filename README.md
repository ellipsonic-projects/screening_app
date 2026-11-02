<div align="center">
  <img src="public/logo.png" alt="EllipHire Logo" width="150"/>
  <h1>EllipHire</h1>
  <p><strong>Smart Assessment & Recruitment Platform (v1.0.0)</strong></p>
</div>

---

## 📌 Project Overview
**EllipHire** is a comprehensive, end-to-end smart assessment platform designed to streamline the recruitment process. It enables organizations to assess students/candidates securely, evaluate responses (including code and unstructured text) automatically via AI, and manage question banks efficiently using Excel templates.

## ✨ Features
- **Role-Based Workflows**: Dedicated dashboards for Students, Admins, and Super Admins.
- **Dynamic Assessment Engine**: Supports MCQs, Coding Challenges, Open Text, and Structured Responses.
- **AI-Powered Evaluation**: Leverages OpenAI and the Piston API to automatically execute, judge, and score coding and open-text submissions.
- **Robust Question Bank**: Create questions manually or import thousands instantly via Excel templates.
- **Anti-Cheat Mechanics**: Tracks tab switches, window blurs, copy-pasting, and missing camera feeds.
- **Comprehensive Analytics & Export**: Generate insights, track percentile scores, and export detailed results to CSV/Excel.
- **Docker Ready**: Fully containerized deployment architecture.

## 🛠️ Technology Stack
- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (Serverless)
- **Database**: PostgreSQL (hosted on Supabase)
- **ORM**: Prisma (v7.8.0)
- **AI Integrations**: OpenAI, Piston API
- **Deployment**: Docker, Vercel

## 📂 Folder Structure
```
/
├── app/                  # Next.js App Router (Pages & API Routes)
├── components/           # Reusable React components (shadcn/ui & custom)
├── docs/                 # Comprehensive Project Documentation
├── lib/                  # Utilities, Prisma Client, AI Evaluation pipelines
├── prisma/               # Database schema and migrations
├── public/               # Static assets (logos, placeholders)
└── types/                # TypeScript type definitions
```

## 🚀 Installation & Local Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in the required keys:
```env
DATABASE_URL="postgresql://postgres.[YOUR-SUPABASE-PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
JWT_SECRET="your-super-secret-key"
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-SUPABASE-PROJECT].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
OPENAI_API_KEY="your-openai-api-key"
```

### 3. Database Setup
Ensure your Supabase project is active, then sync the schema:
```bash
npx prisma generate
npx prisma db push
```

### 4. Run the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000`.

## 🐳 Docker Setup
EllipHire is optimized for production Docker deployment. It uses your local `.env` to connect to Supabase.

**Build and Run**:
```bash
docker compose build
docker compose up -d
```
See `DOCKER.md` or `docs/DEPLOYMENT.md` for more detailed instructions.

## 🔮 Future Scope
- Integration with external ATS systems (Greenhouse, Workday).
- Real-time video proctoring via WebRTC.
- Generative AI-powered dynamic question creation.

## 📄 License
This project is proprietary and confidential. Unauthorized copying, distribution, or reverse-engineering is strictly prohibited.

