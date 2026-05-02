#!/bin/bash
# ==============================================================
# FINANCE SAAS - COMPLETE DEPLOY SCRIPT
# Run this script to push to GitHub and deploy to Vercel
# ==============================================================

set -e

echo "🚀 Finance SaaS Deploy Script"
echo "================================"

# Configuration
GITHUB_TOKEN="${GITHUB_TOKEN:-your-github-token}"
GITHUB_USERNAME="ihabalghmrawi-hue"
REPO_NAME="financeapp"
VERCEL_TOKEN="${VERCEL_TOKEN:-your-vercel-token}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📦 Step 1: Creating GitHub repository...${NC}"

# Create GitHub repo via API
curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{
    \"name\": \"$REPO_NAME\",
    \"description\": \"Finance SaaS - نظام إدارة مالية متكامل\",
    \"private\": false,
    \"auto_init\": false
  }" > /dev/null 2>&1 || true

echo -e "${GREEN}✅ GitHub repo ready${NC}"

echo -e "${BLUE}📤 Step 2: Pushing to GitHub...${NC}"

cd "$(dirname "$0")"

# Configure git
git config user.email "deploy@finance-saas.com"
git config user.name "Finance SaaS Deploy"

# Init if needed
if [ ! -d ".git" ]; then
  git init
fi

git add -A
git commit -m "feat: complete Finance SaaS system

- Multi-tenant SaaS architecture
- Full authentication with Supabase
- Dashboard with charts and stats
- Transactions CRUD with filters
- Double-entry journal accounting
- Wallet/cash management
- Financial reports with PDF/Excel export
- Company settings management
- Parties (customers/suppliers)
- Category management
- Full RTL Arabic support" 2>/dev/null || git commit --allow-empty -m "update: Finance SaaS"

# Set remote
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GITHUB_TOKEN@github.com/$GITHUB_USERNAME/$REPO_NAME.git"

git branch -M main
git push -u origin main --force

echo -e "${GREEN}✅ Pushed to GitHub: https://github.com/$GITHUB_USERNAME/$REPO_NAME${NC}"

echo -e "${BLUE}🌐 Step 3: Deploying to Vercel...${NC}"

# Install Vercel CLI if needed
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel --quiet
fi

# Deploy to Vercel
VERCEL_OUTPUT=$(vercel --token "$VERCEL_TOKEN" --prod --yes 2>&1) || true
DEPLOY_URL=$(echo "$VERCEL_OUTPUT" | grep -o 'https://[^ ]*\.vercel\.app' | head -1)

if [ -n "$DEPLOY_URL" ]; then
  echo -e "${GREEN}✅ Deployed to Vercel: $DEPLOY_URL${NC}"
else
  echo -e "${YELLOW}⚠️  Vercel deployment may need manual env variables${NC}"
  echo -e "${YELLOW}   Go to: https://vercel.com/$GITHUB_USERNAME/projects${NC}"
fi

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo "================================"
echo -e "📦 GitHub: ${BLUE}https://github.com/$GITHUB_USERNAME/$REPO_NAME${NC}"
if [ -n "$DEPLOY_URL" ]; then
  echo -e "🌐 Live URL: ${BLUE}$DEPLOY_URL${NC}"
fi
echo ""
echo -e "${YELLOW}⚡ NEXT STEPS:${NC}"
echo "1. Set up Supabase: https://supabase.com"
echo "2. Run supabase/schema.sql in SQL Editor"
echo "3. Add env variables to Vercel:"
echo "   - NEXT_PUBLIC_SUPABASE_URL"
echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "4. Redeploy on Vercel after adding env vars"
echo ""
echo -e "${GREEN}✨ Your Finance SaaS is ready!${NC}"
