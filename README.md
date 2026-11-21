# 🌟 LoomLead Multi-Tenant SaaS CRM

**LoomLead CRM** is a production-ready, universal, multi-tenant B2B SaaS CRM built for scale and commercial distribution. It features dynamic industry label customization, a Google Maps & Trending Keywords B2B Lead Generator, and an Autonomous In-App AI Agent Copilot.

---

## ⚡ Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Backend API** | Node.js (v20+ LTS), Express.js, **Axios** (Google Maps & external APIs), JWT Auth, Multer, ExcelJS, PDFKit |
| **Frontend SPA** | **Angular (v19+)**, **Bootstrap 5.3.8**, Bootstrap Icons, **Chart.js**, FullCalendar, SortableJS |
| **Database** | **PostgreSQL (v15+)** with multi-tenant data isolation (`tenant_id`), JSONB custom fields, triggers & indexes |
| **Special Engines**| **Google Maps Lead Scraper** (via Axios), **Autonomous AI Agent Copilot** (Voice/Text chat in English & Hinglish) |

---

## 🚀 Key Features

### 1. 🏢 Multi-Tenant SaaS & Super Admin Panel
- Multi-company onboarding with isolated customer workspaces.
- Platform owner **Super Admin Panel** for managing subscriptions, viewing platform MRR/ARR, tenant suspension, and tenant impersonation (*"Login as Tenant"*).

### 2. 🗺️ Google Maps & Trending Keywords Lead Generator
- Search by trending commercial keywords (e.g. *Real Estate in Mumbai, Dental Clinics in Delhi, Gyms in Bangalore*).
- Uses **Axios** to fetch business names, phone numbers, addresses, ratings, and websites.
- **1-Click Bulk Import** into CRM leads with deduplication against existing records.

### 3. 🤖 In-App AI Agent Copilot
- Natural language chat assistant in English and Hindi/Hinglish.
- **Autonomous Navigation:** Say *"Hot leads dikhao"* or *"Open settings"* to navigate instantly.
- **Action Execution:** Say *"Rahul Sharma ko call karne ka task banao kal 3 baje"* to schedule tasks directly.
- **Instant Insights:** Ask for revenue summaries, calls logged, and conversion rates.

### 4. 📊 Graphs & Analytics (Chart.js + Bootstrap 5.3.8)
- Leads by Source (Doughnut chart)
- Monthly Revenue & Deal Trend (Line chart)
- Sales Pipeline Conversion Funnel (Bar chart)
- Staff Performance Ranking

### 5. 📞 Complete Call Tracking & Customer History
- Record call outcomes (*Connected, Busy, No Answer, Wrong Number, Deal Discussed*), duration, and notes.
- Lead 360 view with timeline, notes, tasks, files, quotations, and invoices.

### 6. 📁 Multi-Format Import & Export
- Import contacts and leads from **PDF, Excel (.xlsx), Word (.docx), and CSV**.
- Export any report or list to Excel or PDF.

---

## 💳 Subscription Packages Matrix

| Feature | 1. Free Plan | 2. Basic Plan | 3. Medium (Premium) | 4. Advanced Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Price** | ₹0 | ₹999/mo | ₹2,999/mo | ₹7,999/mo |
| **Users** | 1 Solo User | 3 Users | 10 Users | Unlimited |
| **Leads Limit** | 50 Leads | 1,000 Leads | 10,000 Leads | Unlimited |
| **Google Maps Searches**| 5 / month | 50 / month | 500 / month | 2,500 / month |
| **Pipeline (Kanban)** | ❌ Locked | ✅ Single Pipeline | ✅ Multi-Pipeline | ✅ Custom Funnels |
| **Reports & BI** | Basic | Basic | ✅ Comprehensive | ✅ Full Custom BI |
| **Import / Export** | ❌ Locked | CSV Only | ✅ PDF, Excel, Word, CSV | ✅ Full Backups |
| **Invoicing & Quotes** | ❌ Locked | ❌ Locked | ❌ Locked | ✅ Full Invoicing & GST |
| **AI Copilot** | 5 queries/day | 25 queries/day | 150 queries/day | Unlimited Copilot |

---

## 🛠️ Project Setup & Installation

### 1. Database Setup (PostgreSQL)
Ensure PostgreSQL is running, create the database, and execute the schema:
```bash
# Create database in PostgreSQL
createdb -U postgres loomlead_crm

# Run DDL and Initial Seed script
psql -U postgres -d loomlead_crm -f database/schema.sql
```

### 2. Backend Setup (Node.js + Axios)
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL credentials & Google Maps API key
npm run dev
# Server starts on http://localhost:5000
```

### 3. Frontend Setup (Angular + Bootstrap 5.3.8)
```bash
cd frontend
npm install
npm start
# App starts on http://localhost:4200
```

---

## 🔑 Default Credentials

- **Super Admin Panel:** `admin@loomlead.com` / `password123`
- **Demo Tenant (Apex Realty Group):** `vikram@apexrealty.com` / `password123`
