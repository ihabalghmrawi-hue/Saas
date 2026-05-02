# 🏦 القسم المالي - Finance SaaS

> نظام إدارة مالية متكامل للشركات والمؤسسات
> A complete multi-tenant SaaS Financial Management System

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-cyan)

---

## 🚀 Features

| Module | Description |
|--------|-------------|
| 🔐 **Auth** | Email/password, company creation, JWT sessions |
| 📊 **Dashboard** | Stats cards, bar/line charts, recent transactions |
| 💸 **Transactions** | Full CRUD, filters, pagination, categories |
| 📒 **Journal** | Double-entry accounting, balanced entry validation |
| 💰 **Wallet** | Cash/bank accounts, balance tracking |
| 📈 **Reports** | P&L, monthly breakdown, PDF/Excel export |
| ⚙️ **Settings** | Company info, theme, notifications, security |
| 👥 **Parties** | Customers, suppliers, employee management |
| 🏷️ **Categories** | Custom income/expense categories |

---

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier works)
- Vercel account (free tier works)
- Git + GitHub account

---

## 🗄️ Step 1: Set Up Supabase

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in:
   - **Name**: `finance-saas`
   - **Database Password**: (save this!)
   - **Region**: Choose closest to your users
4. Click **Create new project** and wait ~2 minutes

### 1.2 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Copy the entire content of `supabase/schema.sql`
3. Paste it in the SQL editor
4. Click **Run** (▶)
5. You should see "Success" for all statements

### 1.3 Get API Keys

1. Go to **Settings** → **API**
2. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### 1.4 Configure Auth

1. Go to **Authentication** → **Settings**
2. Under **Site URL**, enter: `http://localhost:3000` (dev) or your Vercel URL
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback`
   - `https://your-app.vercel.app/auth/callback`

---

## 💻 Step 2: Local Development Setup

### 2.1 Clone & Install

```bash
# Clone the repository
git clone https://github.com/ihabalghmrawi-hue/finance-saas.git
cd finance-saas

# Install dependencies
npm install --legacy-peer-deps
```

### 2.2 Environment Variables

```bash
# Copy the example env file
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2.3 Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📤 Step 3: Push to GitHub

```bash
# Initialize git (if not done)
git init
git add .
git commit -m "feat: initial Finance SaaS implementation"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/ihabalghmrawi-hue/finance-saas.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🚀 Step 4: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) → Dashboard
2. Click **Add New** → **Project**
3. Import your GitHub repo `finance-saas`
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave default)
5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
   SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
   NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
   ```
6. Click **Deploy**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Option C: Using Your Vercel Token

```bash
# Install CLI
npm i -g vercel

# Deploy with token
VERCEL_TOKEN=your-vercel-token vercel --prod
```

---

## ✅ Step 5: Post-Deployment

### 5.1 Update Supabase Redirect URLs

After getting your Vercel URL (e.g., `https://finance-saas.vercel.app`):

1. Go to Supabase → **Authentication** → **Settings**
2. Add to **Redirect URLs**:
   ```
   https://finance-saas.vercel.app/auth/callback
   ```

### 5.2 Load Sample Data (Optional)

1. In Supabase SQL Editor
2. Run `supabase/seed.sql` (after creating your account)
3. Replace `YOUR-USER-ID-HERE` with your actual user ID from `auth.users`

### 5.3 Create Your Account

1. Visit your deployed app
2. Click **إنشاء حساب جديد** (Sign Up)
3. Fill in your info + company name
4. Start using the system!

---

## 📁 Project Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── login/          # Login page
│   │   ├── signup/         # Sign up + company creation
│   │   └── callback/       # Supabase auth callback
│   ├── dashboard/
│   │   ├── page.tsx        # Main dashboard
│   │   ├── layout.tsx      # Dashboard layout + sidebar
│   │   ├── transactions/   # Transactions CRUD
│   │   ├── journal/        # Double-entry accounting
│   │   ├── wallet/         # Cash/bank management
│   │   ├── reports/        # Reports + export
│   │   ├── settings/       # Company settings
│   │   ├── parties/        # Customers & suppliers
│   │   └── categories/     # Transaction categories
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── dashboard/          # Dashboard widgets
│   ├── forms/              # Reusable forms
│   ├── layout/             # Sidebar, topbar
│   └── ui/                 # UI primitives
├── lib/
│   ├── supabase/           # Client & server instances
│   └── utils.ts            # Helpers, formatters
├── middleware.ts            # Auth protection
└── types/
    └── database.ts         # TypeScript types
supabase/
├── schema.sql              # Full database schema
└── seed.sql                # Sample data
```

---

## 🔒 Security Features

- **Row Level Security (RLS)** on all tables
- **Multi-tenant isolation** — companies can't access each other's data
- **JWT session management** via Supabase Auth
- **Protected routes** via Next.js middleware
- **HTTPS** enforced on Vercel

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 14 | React framework (App Router) |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Supabase | Auth + PostgreSQL + Storage |
| Recharts | Charts & visualizations |
| jsPDF | PDF export |
| SheetJS (xlsx) | Excel export |
| date-fns | Date utilities |
| Radix UI | Accessible primitives |
| Vercel | Deployment |

---

## 🌍 Arabic RTL Support

The app is fully RTL (right-to-left) with:
- Cairo font for Arabic text
- `dir="rtl"` on HTML element
- Tailwind RTL utilities
- Bilingual support (Arabic + English)

---

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/ihabalghmrawi-hue/finance-saas/issues)
- Email: Available in Settings → Support

---

## 📄 License

MIT License — Free to use and modify
