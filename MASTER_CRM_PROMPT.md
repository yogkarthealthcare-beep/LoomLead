# 🚀 ULTIMATE MASTER PROMPT: LOOMLEAD MULTI-TENANT SAAS CRM
### Full-Stack Architecture: Angular + Bootstrap 5.3.8 Frontend | Node.js + Axios Backend | PostgreSQL Multi-Tenant Database | Google Maps Lead Scraper | Autonomous In-App AI Agent Copilot

---

## 📋 PROMPT INSTRUCTIONS (HOW TO USE)
Copy and paste the prompt below into any AI model, developer briefing, or use it as the complete technical product requirement specification (PRD) to build the complete **LoomLead CRM** enterprise SaaS application.

---

```text
========================================================================================
PROJECT BRIEF: BUILD "LOOMLEAD CRM" - COMPLETE MULTI-TENANT SAAS CRM PLATFORM
========================================================================================

You are an expert Principal Full-Stack SaaS Architect and Senior Software Engineer.
Build a complete, universal, production-ready, subscription-based Multi-Tenant CRM web application named "LoomLead CRM".
The system must be ready to be sold to multiple businesses/customers (Tenants), allowing them to register, pick a subscription plan, configure their industry terminology, and run their sales and customer operations seamlessly.

=========================================================
1. TECHNOLOGY STACK REQUIREMENTS
=========================================================
- BACKEND:
  * Runtime: Node.js (v20+ LTS) with Express.js.
  * HTTP Client: Axios (strictly required for external API communications, webhooks, Google Places API, and AI model inference).
  * Database: PostgreSQL (v15+) with full multi-tenant isolation using `tenant_id` foreign keys, relational integrity, indexes, and JSONB custom fields.
  * Auth & Security: JWT (JSON Web Tokens), bcrypt password hashing, Role-Based Access Control (RBAC), helmet, cors, express-rate-limit.
  * File & Document Processing:
    - Multer for secure uploads.
    - ExcelJS / xlsx for Excel import and export.
    - PDFKit / Puppeteer for dynamic invoice, quotation, and report PDF generation.
    - Mammoth / docx for Word file text extraction and import.
    - csv-parser for rapid CSV stream imports.

- FRONTEND:
  * Framework: Angular (v19+ standalone components or modular architecture).
  * Design & CSS Framework: Bootstrap 5.3.8 (strictly modern, clean, responsive SaaS UI) + Bootstrap Icons.
  * Analytics & Visualizations: Chart.js / ng2-charts (Doughnut, Bar, Line, Funnel, Radar charts).
  * Drag & Drop & Calendars: SortableJS (for Kanban pipelines), FullCalendar (for scheduled calls, tasks, appointments).
  * Reactive State & Forms: Reactive Forms with real-time validation, RxJS subjects for global alerts, toasts, and plan-gating triggers.
  * Theme Support: Light and Dark mode toggle with persistent state.

=========================================================
2. SPECIAL ADVANCED CORE MODULES
=========================================================

### MODULE 1: GOOGLE MAPS & TRENDING KEYWORDS B2B LEAD GENERATOR
- Purpose: Allow users to discover fresh business leads directly inside the CRM without third-party lead lists.
- Functionality:
  1. User enters or selects a Trending Niche Keyword (from Google Trends or YouTube commercial trends like "Interior Designers in Mumbai", "Dental Clinics in Bangalore", "Real Estate Agents in Pune", "Gyms in Delhi NCR").
  2. The Node.js backend uses AXIOS to query the Google Places API / Google Maps Text Search API.
  3. Extracted Data Fields:
     * Business Name
     * Primary Phone & Contact Number
     * Full Formatted Physical Address (Street, City, State, Pincode)
     * Google Maps Place ID and Rating (e.g., 4.7 stars, 128 reviews)
     * Website URL
     * Business Category / Niche
  4. Deduplication & Preview:
     * Results are previewed in a responsive Bootstrap table with check-boxes.
     * The system automatically highlights existing leads already present in the database to prevent duplicates.
  5. One-Click Bulk Import:
     * Users click "Import Selected to CRM Leads", which immediately creates lead records assigned to the selected sales representative with source tag = "Google Maps Extraction".

### MODULE 2: AUTONOMOUS BUILT-IN AI AGENT COPILOT
- Purpose: A conversational in-app copilot that accepts natural language commands (English & Hinglish) to execute actions, navigate pages, provide suggestions, and summarize data.
- UI: Floating AI Assistant pill in the bottom-right corner + modal drawer + keyboard shortcut (`Ctrl + K` or `Cmd + K`).
- Core Capabilities:
  1. Autonomous Navigation:
     * User prompt: "Take me to pending invoices" or "Hot leads ka page open karo"
     * AI Agent executes: Angular router navigation to `/invoices?status=pending` or `/leads?score=hot`.
  2. Action Execution & Record Creation:
     * User prompt: "Rahul Sharma ko call karne ka task banao kal 3 baje priority high"
     * AI Agent parses intent and entities (Lead: Rahul Sharma, Due Date: Tomorrow 15:00, Type: Call, Priority: High) and makes a POST call to create the task.
     * User prompt: "Mark lead #102 as Won"
     * AI Agent executes status transition with an interactive confirmation card.
  3. Smart Suggestions:
     * On the Lead Detail page, AI analyzes timeline: "This lead has not been contacted for 4 days. Would you like me to schedule a WhatsApp follow-up or log a call?"
  4. Query & Analytics Insights:
     * User prompt: "Is mahine ka total sales conversion aur revenue kitna hai?"
     * AI Agent computes metrics and presents an executive summary with interactive breakdown buttons.

### MODULE 3: MULTI-TENANT SAAS ARCHITECTURE & SELLING MODEL
- Multi-Company Onboarding:
  * Any business owner can register, create a tenant workspace (`mycompany.loomlead.com` or subdomain/tenant slug), select their industry, and invite their team members.
  * Every tenant has independent data isolation via PostgreSQL `tenant_id`.
- Dynamic Industry Presets:
  * Re-label entity names dynamically per industry preset:
    - Real Estate: Leads -> "Buyers / Investors", Value -> "Property Budget"
    - Healthcare: Leads -> "Patients", Value -> "Treatment Estimate"
    - Education: Leads -> "Students / Inquiries", Value -> "Course Fee"
    - Consulting / Agencies: Leads -> "Clients / Prospects", Value -> "Project Value"

=========================================================
3. SUBSCRIPTION TIERS & FEATURE GATING MATRIX
=========================================================
The application enforces 4 subscription plans. A central Plan Config engine checks limits on every backend API request and frontend action:

| Plan Dimension | 1. FREE PLAN | 2. BASIC PLAN | 3. MEDIUM (PREMIUM) | 4. ADVANCED PLAN |
| :--- | :--- | :--- | :--- | :--- |
| **Target Audience** | Freelancer / Solo | Small Startup | Growing Business | Enterprise Agency |
| **Price (Monthly / Yearly)**| ₹0 / $0 | ₹999 / $19/mo | ₹2,999 / $49/mo | ₹7,999 / $129/mo |
| **Max Users** | 1 User only | Up to 3 Users | Up to 10 Users | Unlimited Users |
| **Max Leads** | 50 Leads total | 1,000 Leads | 10,000 Leads | Unlimited Leads |
| **Google Maps Leads/Mo** | 5 leads / month | 50 leads / month | 500 leads / month | 2,500 leads / month |
| **Pipeline Kanban** | ❌ Locked | ✅ Single Pipeline | ✅ Multi-Pipeline | ✅ Custom Funnels |
| **Reports & BI Analytics** | Basic stats only | Basic Bar charts | ✅ Comprehensive BI | ✅ Custom Exports & BI |
| **Import / Export** | ❌ Locked | CSV Only | ✅ PDF, Excel, Word, CSV | ✅ Full Data Portability |
| **Quotations & Invoices** | ❌ Locked | ❌ Locked | ❌ Locked | ✅ Full Invoicing & GST |
| **Product / Services Catalog**| ❌ Locked | ❌ Locked | Up to 25 items | Unlimited Catalog |
| **Custom Fields** | 0 | Up to 5 Fields | Up to 20 Fields | Unlimited Fields |
| **Automation Rules** | ❌ Locked | ❌ Locked | 3 Basic Rules | Unlimited Full Rules |
| **Roles & Permissions** | Owner only | Owner + Staff | Admin, Manager, Staff | Custom Roles Matrix |
| **AI Agent Copilot** | 5 queries / day | 25 queries / day | 150 queries / day | Unlimited Copilot |
| **Support** | Self-serve FAQ | Email (48 hrs) | Priority Email (12 hrs)| 24/7 Phone & WhatsApp |

*Gating Rules:*
- Soft warning banner appears at 80% usage of leads or users.
- Hard block modal appears at 100% usage with an "Upgrade Plan" CTA that opens the Checkout page.
- Expired plans retain all existing data in read-only mode but block creating new records until renewed.

=========================================================
4. COMPLETE POSTGRESQL DATABASE SCHEMA (DDL SPECIFICATION)
=========================================================
Create the following PostgreSQL tables with proper constraints, foreign keys, triggers, and indexes:
1. `tenants`: id (UUID), company_name, slug, logo_url, industry, currency, timezone, date_format, labels_json (JSONB), created_at, updated_at.
2. `plans`: id, code ('free', 'basic', 'medium', 'advanced'), name, price_monthly, price_yearly, limits_json (JSONB), features_json (JSONB), is_active.
3. `subscriptions`: id (UUID), tenant_id, plan_id, status ('active', 'expired', 'trial', 'cancelled'), billing_cycle ('monthly', 'yearly'), starts_at, expires_at, auto_renew.
4. `users`: id (UUID), tenant_id, name, email, password_hash, phone, avatar_url, role ('superadmin', 'admin', 'manager', 'staff', 'viewer'), status ('active', 'inactive'), last_login_at.
5. `leads`: id (UUID), tenant_id, name, phone, alt_phone, email, company_name, address, city, state, pincode, source, status, score ('hot', 'warm', 'cold'), stage_id, assigned_to_user_id, budget_value, notes, next_followup_at, created_at, updated_at.
6. `call_logs`: id (UUID), tenant_id, lead_id, user_id, direction ('outbound', 'inbound'), duration_seconds, outcome ('connected', 'busy', 'no_answer', 'wrong_number', 'voicemail'), notes, recording_url, created_at.
7. `tasks`: id (UUID), tenant_id, lead_id, assigned_to_user_id, title, type ('call', 'meeting', 'email', 'site_visit'), priority ('high', 'medium', 'low'), due_date, status ('pending', 'completed'), reminder_at.
8. `pipeline_stages`: id (UUID), tenant_id, name, order_index, color_hex, is_won, is_lost.
9. `quotations`: id (UUID), tenant_id, lead_id, quote_number, issue_date, valid_till, subtotal, discount, tax_amount, total_amount, status ('draft', 'sent', 'accepted', 'rejected', 'expired'), terms_conditions.
10. `quote_items`: id (UUID), quotation_id, product_name, sku, quantity, unit_price, tax_percent, total_price.
11. `invoices`: id (UUID), tenant_id, lead_id, quote_id, invoice_number, invoice_date, due_date, total_amount, paid_amount, balance_amount, status ('paid', 'pending', 'partial', 'overdue').
12. `payments`: id (UUID), tenant_id, invoice_id, amount, payment_mode ('upi', 'card', 'bank_transfer', 'cash'), payment_date, transaction_reference, notes.
13. `products_services`: id (UUID), tenant_id, name, sku, category, unit_price, tax_percent, status.
14. `communication_templates`: id (UUID), tenant_id, name, channel ('whatsapp', 'sms', 'email'), subject, body_content, variables_json (JSONB).
15. `communication_logs`: id (UUID), tenant_id, lead_id, user_id, channel, direction, message_content, status.
16. `custom_fields`: id (UUID), tenant_id, field_name, field_label, field_type ('text', 'number', 'date', 'dropdown', 'checkbox', 'file'), module ('leads', 'tasks'), options_json (JSONB), is_required, order_index.
17. `custom_field_values`: id (UUID), tenant_id, custom_field_id, entity_id, field_value.
18. `automation_rules`: id (UUID), tenant_id, name, trigger_event, conditions_json (JSONB), actions_json (JSONB), is_active.
19. `google_maps_leads`: id (UUID), tenant_id, search_keyword, location_query, place_id, raw_data_json (JSONB), is_imported, imported_lead_id, created_at.
20. `ai_conversations`: id (UUID), tenant_id, user_id, user_message, ai_response, actions_executed_json (JSONB), created_at.
21. `audit_logs`: id (UUID), tenant_id, user_id, module, action_type, record_id, old_values (JSONB), new_values (JSONB), ip_address, created_at.
22. `coupons`: id (UUID), code, discount_type ('percentage', 'fixed'), discount_value, max_uses, current_uses, expires_at, is_active.
23. `support_tickets`: id (UUID), tenant_id, user_id, subject, category, message, attachment_url, priority, status ('open', 'in_progress', 'resolved', 'closed'), created_at.

=========================================================
5. COMMON PAGE STANDARDS & UI/UX RULES
=========================================================
Every list/table page across the application must strictly adhere to:
- Real-time Live Search: Instant client-side & server-debounced search across relevant fields with clear (x) button.
- Comprehensive Filters: Dropdown filters + Date range picker + "Reset filters" button + Saved filter presets.
- Column Sorting: Ascending/Descending indicators on all table headers.
- Pagination: Configurable rows per page (10, 25, 50, 100), active page numbers, and "Showing X-Y of Z records" indicator.
- Multi-Row Bulk Actions: Row checkboxes + "Select All" checkbox. Floating action bar to Assign Staff, Update Status, Add Tag, Delete, or Export Selected.
- Quick Inline Actions: Call (click-to-call modal), WhatsApp (pre-filled message), Email, Add Task, Edit, Delete (with confirm modal).
- Column Chooser: Dropdown allowing users to show/hide specific columns with localStorage persistence.
- Export & Print: 1-click export to CSV, Excel (.xlsx), and PDF + Print formatted view.
- Empty & Loading States: Modern illustration/icon for zero-records state with primary CTA + Skeleton loaders during data fetch.
- Plan Gating Modals: Feature locks show padlock icons; clicking them displays an "Upgrade Your Plan" modal with instant plan comparison.

=========================================================
6. COMPLETE PAGE-BY-PAGE SPECIFICATION
=========================================================

### A. PUBLIC PAGES (Before Login)
1. Landing Page:
   - Modern hero section with animated CTA "Start 14-Day Free Trial" & "Book Live Demo".
   - Key feature grid (Lead Automation, Google Maps Prospector, WhatsApp CRM, Invoicing, AI Copilot).
   - Industry Selector Tabs (Real Estate, Healthcare, Education, Agencies) demonstrating dynamic terminology.
   - Live Interactive Pricing Calculator (Monthly vs Yearly 20% discount toggle).
   - Customer Testimonials & Case Studies carousel.
   - Interactive FAQ accordion.
   - Comprehensive footer with links, security badges, and contact options.

2. Pricing Page:
   - 4-Tier Interactive Cards: Free (₹0), Basic (₹999), Medium (₹2,999), Advanced (₹7,999).
   - Monthly / Annual toggle (with "Save 20%" badge).
   - Detailed feature-by-feature comparison table with checkmarks and tooltips.
   - FAQ section addressing billing, upgrades, and cancellations.

3. Registration Page:
   - Fields: Full Name, Company Name, Business Email, Phone Number, Industry dropdown, Password + Confirm Password.
   - Password strength meter (Length, Special Char, Number, Uppercase).
   - Terms & Privacy checkbox.
   - "Create Free Account" button (automatically provisions tenant on Free Plan).

4. Login Page:
   - Email, Password, Show/Hide password toggle, "Remember Me" checkbox, "Forgot Password?" link.
   - "Sign In with Google" OAuth button.

5. Password Recovery Suite:
   - Forgot Password (Email input -> send reset link).
   - OTP Verification (6 discrete boxes with auto-focus and 60-second resend countdown).
   - Reset Password (New password + strength meter + validation).

6. Legal & System Error Pages:
   - Terms of Service & Privacy Policy pages.
   - 404 Not Found, 403 Access Denied / Upgrade Required, and Plan Expired Grace-Period page.

---

### B. APP PAGES (Tenant Dashboard After Login)
1. DASHBOARD:
   - Global Date Range Filter (Today / Last 7 Days / Last 30 Days / This Month / Custom Date Range).
   - 7 Key KPI Stat Cards:
     * Total Leads (with % change vs last period)
     * New Leads Today
     * Follow-ups Due Today (highlighted red if overdue)
     * Calls Made Today
     * Won Deals & Lost Deals
     * Conversion Rate %
     * Total Projected Pipeline Revenue (₹ / $)
   - Interactive Visual Charts (Chart.js):
     * Leads by Source (Doughnut Chart)
     * Monthly Revenue & Leads Trend (Spline Line Chart)
     * Pipeline Conversion Funnel (Horizontal Bar Chart)
     * Team Sales Performance (Grouped Bar Chart)
   - Live Widgets:
     * Today's Scheduled Calls & Tasks (with inline completion checkboxes)
     * Overdue Follow-ups Alert Box
     * Real-time Activity Audit Feed
     * Plan Usage Progress Bar (Leads X/1000, Users X/3) + Expiry notification.
   - Quick Action Header: "+ New Lead", "+ Schedule Call", "+ Quick Task".

2. GOOGLE MAPS LEAD GENERATOR (Special B2B Prospector Page):
   - Trending Niche Keywords Bar: Clickable chips ("Real Estate Mumbai", "Gyms Bangalore", "Doctors Pune", "Software Companies Delhi", "Restaurants Hyderabad").
   - Search Form: Search Query, Target City / Region, Radius (km), Google Places Type filter.
   - Search Execution: Calls backend Axios API -> Google Places Search -> live response.
   - Results Data Table:
     * Checkbox, Business Name, Phone Number (with copy button), Rating & Reviews, Full Address, Website link, Status ("New" / "Already in CRM").
   - Actions:
     * "Import Selected to CRM" (modal to select Assignee, Stage, and Tags).
     * Export Search Results to Excel / CSV.
   - Monthly Extraction Quota Meter (e.g., "Used 42 / 500 extractions this month").

3. LEADS & CONTACTS MANAGEMENT:
   - Search: Instant multi-field search (Name, Phone, Email, Company, City).
   - Filters: Status, Lead Source, Assigned Sales Rep, Score (Hot/Warm/Cold), Stage, Date Range, City.
   - Table Columns: Checkbox, Lead Name, Phone, Email, Company, Source, Stage Badge, Score Badge, Assigned Staff Avatar, Next Follow-up Date/Time, Created Date, Actions.
   - Inline Row Actions:
     * Call (opens Call Modal to record duration, outcome, and notes).
     * WhatsApp (opens WhatsApp Web / Cloud API message modal).
     * Email & SMS triggers.
     * Edit Lead & Delete Lead.
   - Bulk Actions: Reassign to Staff, Bulk Status Change, Apply Tags, Delete, Export to Excel/PDF.
   - View Switcher: Table View / Grid Cards View / Kanban Funnel View.
   - Duplicate Detection: Real-time duplicate phone/email warning banner.

4. ADD / EDIT LEAD:
   - Form Sections: Basic Contact Info, Business / Company Details, Lead Scoring & Assignment, Budget & Revenue Value, Follow-up Schedule, Custom Dynamic Fields.
   - Instant Duplicate Validation (debounced check against existing database records).
   - Buttons: "Save Lead", "Save & Add Another", "Cancel".

5. 360-DEGREE LEAD DETAIL PAGE:
   - Header Bar: Avatar, Contact Name, Stage Badge, Score Badge, Owner, Fast Actions (Call, WhatsApp, Email, Convert to Customer, Edit, Delete).
   - Tab 1: Overview (All contact fields, company profile, location map).
   - Tab 2: Activity Timeline (Chronological timeline of all changes, stage transitions, and emails).
   - Tab 3: Call Logs (History of calls, outcome badges, durations, audio recordings/notes, "+ Log New Call" button).
   - Tab 4: Tasks & Follow-ups (Due follow-ups, scheduled meetings, completed tasks).
   - Tab 5: Notes (Rich-text notes with pin-to-top option).
   - Tab 6: Files & Documents (Upload agreements, invoices, PDF/Word documents, file preview).
   - Tab 7: Quotations & Invoices (Linked quotes and invoices with payment status).
   - Tab 8: Custom Fields (Dynamic tenant-defined fields).
   - Right Sidebar: Quick Status Changer, Next Follow-up scheduler, Tags manager.

6. SALES PIPELINE (Kanban Board):
   - Dynamic Columns = Pipeline Stages (e.g., New -> Contacted -> Qualified -> Proposal Sent -> Negotiation -> Won -> Lost).
   - Column Headers: Stage Name, Total Lead Count, Cumulative Deal Value in ₹/$.
   - Interactive Drag & Drop: Drag cards seamlessly between columns using SortableJS.
   - Kanban Card Details: Lead Name, Value, Priority Badge, Assigned User Avatar, Next Follow-up Date, Quick Call/WhatsApp icons.
   - Stage Management: Add new stage, rename, re-order, change color, mark as "Won" or "Lost" with reason popup.

7. TASKS & CALL FOLLOW-UPS:
   - Views: List View, Board View (To Do / In Progress / Completed), and Due Today Queue.
   - Filters: Overdue, Due Today, Upcoming, Priority (High/Medium/Low), Assignee, Task Type (Call, Meeting, Email, Visit).
   - Columns: Checkbox, Task Title, Related Lead, Type, Priority Badge, Due Date/Time, Assignee, Status, Actions.
   - Reminder Alerts: Browser push notifications + In-app popups 15 minutes before scheduled call.

8. FULLCALENDAR SCHEDULER:
   - Views: Month, Week, Day, Agenda List.
   - Interactive: Click date cell to schedule meeting/follow-up, drag event to reschedule.
   - Color coding by Task Type and Priority.

9. COMMUNICATION CENTER:
   - WhatsApp & SMS Templates: Create reusable templates with dynamic variables (`{lead_name}`, `{company_name}`, `{followup_date}`).
   - Bulk Broadcast: Send personalized WhatsApp/Email to filtered leads (subject to plan limits).
   - Unified Communication Log: Complete audit log of every email, SMS, and WhatsApp triggered.

10. ADVANCED REPORTS & BUSINESS ANALYTICS (Medium+ Plan):
    - Report Types:
      * Lead Source ROI (Cost per lead, conversion rate per source).
      * Team Performance (Calls logged, deals closed, average response time).
      * Sales Conversion Funnel Drop-off.
      * Lost Reason Analysis (Price, Competitor, Not Interested).
      * Revenue & Collection Forecasting.
    - Exporting: 1-click Download as PDF Report or Excel Sheet.

11. PRODUCTS & SERVICES CATALOG (Advanced Plan):
    - Product Management: Name, SKU, Category, Cost Price, Selling Price, Tax/GST %, Status.

12. QUOTATIONS GENERATOR (Advanced Plan):
    - Quotation Builder: Select Lead -> Add Catalog Products -> Auto-calculate Tax, Discounts, and Grand Total -> Add Payment Terms.
    - Downloadable Professional PDF Quotation with company logo and signature block.
    - Convert accepted Quotation to Invoice in 1 click.

13. INVOICES & PAYMENT TRACKING (Advanced Plan):
    - Invoicing: Generate GST-compliant invoices with automatic invoice numbering (`INV-2026-001`).
    - Payment Recording: Log partial/full payments (Amount, Mode, Transaction ID, Date).
    - Auto-calculated Balance Due and Overdue status badge.
    - PDF Invoice Download and WhatsApp/Email delivery.

14. TEAM & USER MANAGEMENT:
    - User Directory: Name, Email, Phone, Role, Assigned Leads count, Last Login, Status.
    - Actions: Invite New User via Email, Edit Role, Activate/Deactivate, Reset Password, Reassign Leads on Deletion.
    - User Quota Meter based on subscription plan.

15. ROLES & PERMISSIONS MATRIX (Medium+ Plan):
    - Matrix View: Modules (Leads, Pipelines, Reports, Invoices, Settings) x Permissions (View, Create, Edit, Delete, Export).
    - Custom Role Creator (e.g., "Telecaller", "Sales Manager", "Accountant").

16. AUTOMATION WORKFLOW RULES (Medium basic / Advanced full):
    - Visual Rule Builder:
      * Trigger: When New Lead Created / When Status Changed to "Won" / When No Activity for 5 Days.
      * Condition: If Lead Source is "Google Maps" AND Score is "Hot".
      * Action: Auto-assign to Senior Rep, send Welcome WhatsApp message, and create Follow-up Task.

17. DATA IMPORT & EXPORT ENGINE:
    - Import Wizard: Support for **Excel (.xlsx), CSV, Word (.docx text extraction), and PDF contact lists**.
    - Column Mapping: Drag/select interface to map file columns (e.g., "Mobile No" -> Phone, "Client Name" -> Name).
    - Duplicate Resolution: Options to "Skip Duplicates", "Overwrite Existing", or "Create Copy".
    - Export Engine: Export any filtered dataset into formatted Excel, CSV, or PDF with company branding.

18. CUSTOM FIELDS BUILDER:
    - Add custom fields to Leads and Tasks (Text, Number, Date, Dropdown, Multi-select, File upload).
    - Dynamic form rendering throughout the application.

19. GENERAL & INDUSTRY SETTINGS:
    - Industry Customizer: One-click preset dropdown (Real Estate, Healthcare, Education, Consulting, Retail) that renames all labels throughout the UI.
    - Company Profile: Name, Logo upload, GST / Tax ID, Currency (INR ₹, USD $, EUR €), Timezone.
    - Integrations: Google Places API Key, WhatsApp Cloud API Token, Razorpay / Stripe credentials.

20. NOTIFICATION & AUDIT LOGS:
    - In-app notification center bell with unread counter.
    - Immutable Audit Log recording user actions, IP addresses, timestamp, and previous vs new values.

21. BILLING, SUBSCRIPTION & CHECKOUT:
    - Current Plan Status card, active billing cycle, renewal date, usage meters.
    - Plan Upgrade / Downgrade / Cancel modal.
    - Checkout Page: Order summary, Coupon Code input with real-time discount calculation, Payment Gateway integration (Razorpay/Stripe), Tax calculation, and Invoice download.

22. HELP & SUPPORT TICKETS:
    - In-app ticket raising system (Subject, Category, Priority, Attachment).
    - Searchable Knowledgebase & FAQ articles.

---

### C. SUPER ADMIN PANEL (Platform Owner Portal)
1. Super Admin Dashboard:
   - Global MRR (Monthly Recurring Revenue) & ARR.
   - Total Registered Companies (Tenants), Active vs Suspended vs Expired accounts.
   - Plan-wise Subscription Distribution Chart.
2. Tenant Companies Directory:
   - Search by company name, owner email, or phone.
   - Status toggles: Active, Suspended, Expired.
   - "Login as Tenant" (Super Admin Impersonation) to assist customers directly.
   - Manually extend trial / subscription validity.
3. Plans & Pricing Editor:
   - Edit monthly/yearly prices, lead limits, user limits, and feature toggles dynamically.
4. Global Transactions & Invoices:
   - Searchable ledger of all SaaS subscription payments with PDF receipt generation.
5. Coupon Management:
   - Create promo codes (% or fixed discount, max usage count, expiry date).
6. Support Ticket Desk:
   - View, assign, and reply to support queries submitted by tenant companies.
7. Broadcast Announcements:
   - Publish system-wide banner announcements to all or specific subscription tiers.
8. System Settings:
   - Global API keys (Google Maps API, SendGrid, Twilio/WhatsApp, Razorpay).

=========================================================
7. DELIVERABLE REQUIREMENTS & ARCHITECTURE RULES
=========================================================
1. Clean code architecture with separation of concerns:
   - `backend/src/controllers`: Request handlers.
   - `backend/src/routes`: Modular Express route definitions.
   - `backend/src/middleware`: JWT authentication, multi-tenant resolver (`req.tenantId`), plan-gating guard, RBAC permission checker.
   - `backend/src/services`: Business logic (Google Maps Axios scraper, AI copilot engine, billing, PDF generation).
   - `backend/src/db`: PostgreSQL pool, migrations, and seeds.
   - `frontend/src/app`: Angular components, services, guards, interceptors (attaching JWT & tenant header), and state.
2. Include realistic dummy data for 25+ leads across stages, 15 call logs, 10 tasks, 5 team users, and pre-configured subscription plans.
3. Provide complete PostgreSQL DDL schema with tables, indexes, and triggers.
========================================================================================
```
