# Backend Setup Guide

This guide explains how to set up the PostgreSQL database backend and deploy to Azure.

## Database Schema

The application uses the following main tables:

- **Company** - Organization/tenant info
- **XeroToken** - OAuth tokens and credentials
- **BankAccount** - Bank accounts from Xero
- **Transaction** - Bank transactions with AI coding
- **Contact** - Suppliers and customers
- **Invoice** - Sales and purchase invoices
- **Employee** - Staff from Xero Payroll
- **Payrun** - Payroll runs
- **ActivityStatement** - BAS/GST reporting data
- **SyncLog** - Audit trail of data syncs

## Local Development Setup

### 1. Install PostgreSQL

**Option A: Docker (Recommended)**

```bash
docker run --name aitax-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=aitax \
  -p 5432:5432 \
  -d postgres:15
```

**Option B: Local Installation**
- Download from https://www.postgresql.org/download/
- Create database: `CREATE DATABASE aitax;`

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and update:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/aitax?schema=public"
NEXT_PUBLIC_XERO_REDIR=http://localhost:3000/api/xero/callback
OPENAI_API_KEY=your_key_here
```

### 3. Run Database Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma migrate dev --name init

# Optional: Open Prisma Studio to view data
npx prisma studio
```

### 4. Start Development Server

```bash
npm run dev
```

## Azure Deployment

### Architecture

```
Azure App Service (Next.js)
    ↓
Azure Database for PostgreSQL
    ↓
Azure OpenAI Service (Optional)
```

### Step 1: Create Azure Database for PostgreSQL

```bash
# Login to Azure
az login

# Create resource group
az group create --name aitax-rg --location australiaeast

# Create PostgreSQL server
az postgres flexible-server create \
  --resource-group aitax-rg \
  --name aitax-db \
  --location australiaeast \
  --admin-user aitaxadmin \
  --admin-password 'YourSecurePassword123!' \
  --sku-name Standard_B2s \
  --tier Burstable \
  --version 15 \
  --storage-size 32

# Create database
az postgres flexible-server db create \
  --resource-group aitax-rg \
  --server-name aitax-db \
  --database-name aitax

# Configure firewall (allow Azure services)
az postgres flexible-server firewall-rule create \
  --resource-group aitax-rg \
  --name aitax-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Step 2: Get Connection String

```bash
az postgres flexible-server show-connection-string \
  --server-name aitax-db \
  --database-name aitax \
  --admin-user aitaxadmin \
  --admin-password 'YourSecurePassword123!'
```

Format will be:
```
postgresql://aitaxadmin:YourSecurePassword123!@aitax-db.postgres.database.azure.com:5432/aitax?sslmode=require
```

### Step 3: Create Azure App Service

```bash
# Create App Service plan (Linux)
az appservice plan create \
  --resource-group aitax-rg \
  --name aitax-plan \
  --sku B2 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group aitax-rg \
  --plan aitax-plan \
  --name aitax-app \
  --runtime "NODE:18-lts"

# Configure environment variables
az webapp config appsettings set \
  --resource-group aitax-rg \
  --name aitax-app \
  --settings \
    DATABASE_URL="postgresql://aitaxadmin:YourSecurePassword123!@aitax-db.postgres.database.azure.com:5432/aitax?sslmode=require" \
    NEXT_PUBLIC_XERO_REDIR="https://aitax-app.azurewebsites.net/api/xero/callback" \
    OPENAI_API_KEY="your_openai_key"
```

### Step 4: Deploy Application

**Option A: GitHub Actions (Recommended)**

1. Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Build application
        run: npm run build

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'aitax-app'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
```

2. Get publish profile:
```bash
az webapp deployment list-publishing-profiles \
  --resource-group aitax-rg \
  --name aitax-app \
  --xml
```

3. Add to GitHub Secrets as `AZURE_WEBAPP_PUBLISH_PROFILE`

**Option B: Azure CLI**

```bash
# Build locally
npm run build

# Deploy
az webapp deployment source config-zip \
  --resource-group aitax-rg \
  --name aitax-app \
  --src ./build.zip
```

### Step 5: Run Database Migrations on Azure

```bash
# Connect to your Azure database and run migrations
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Step 6: Configure Xero Redirect URI

Update your Xero app settings:
- Go to https://developer.xero.com/app/manage
- Add redirect URI: `https://aitax-app.azurewebsites.net/api/xero/callback`

## Optional: Azure OpenAI Setup

If you want to use Azure OpenAI instead of OpenAI:

```bash
# Create Azure OpenAI resource
az cognitiveservices account create \
  --resource-group aitax-rg \
  --name aitax-openai \
  --location australiaeast \
  --kind OpenAI \
  --sku S0

# Deploy GPT-4o-mini model
az cognitiveservices account deployment create \
  --resource-group aitax-rg \
  --name aitax-openai \
  --deployment-name gpt-4o-mini \
  --model-name gpt-4o-mini \
  --model-version "1" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name "Standard"

# Get API key
az cognitiveservices account keys list \
  --resource-group aitax-rg \
  --name aitax-openai
```

Update environment variables:
```env
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://aitax-openai.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

## API Endpoints

### Token Management
- `GET /api/token/[companyId]` - Get Xero token
- `POST /api/token` - Create new token
- `PUT /api/token` - Update token

### OAuth
- `GET /api/xero/callback` - OAuth callback handler

### Data Sync
- `POST /api/sync/[companyId]` - Sync data from Xero
  - Body: `{ "syncType": "all|bank_accounts|transactions|invoices|employees|payruns", "fromDate": "2024-01-01" }`
- `GET /api/sync/[companyId]` - Get sync logs

### Transactions
- `GET /api/transactions/[companyId]` - Get transactions
  - Query: `?unreconciled=true&uncoded=true`
- `POST /api/transactions/code` - AI code transaction
  - Body: `{ "transactionId": "xxx", "companyId": 1 }`

## Database Maintenance

### Backup (Azure)

```bash
# Manual backup
az postgres flexible-server backup create \
  --resource-group aitax-rg \
  --name aitax-db \
  --backup-name manual-backup-$(date +%Y%m%d)
```

Azure automatically creates daily backups with 7-day retention.

### View Data with Prisma Studio

```bash
# Local
npx prisma studio

# Azure (requires connection string)
DATABASE_URL="azure_connection_string" npx prisma studio
```

## Monitoring

### Application Insights (Recommended)

```bash
# Create Application Insights
az monitor app-insights component create \
  --resource-group aitax-rg \
  --app aitax-insights \
  --location australiaeast \
  --application-type web

# Link to App Service
az webapp config appsettings set \
  --resource-group aitax-rg \
  --name aitax-app \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=xxx"
```

### Logs

```bash
# View live logs
az webapp log tail \
  --resource-group aitax-rg \
  --name aitax-app
```

## Cost Estimation (Azure - Australia East)

- **App Service (B2)**: ~$70 AUD/month
- **PostgreSQL (Standard_B2s)**: ~$45 AUD/month
- **Azure OpenAI (pay-per-use)**: ~$0.15 per 1M tokens
- **Total**: ~$115 AUD/month + OpenAI usage

## Troubleshooting

### Database Connection Issues

1. Check firewall rules
2. Verify connection string
3. Test connection: `psql "postgresql://..."`

### Prisma Issues

```bash
# Regenerate client
npx prisma generate

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

### Deployment Issues

```bash
# View deployment logs
az webapp log deployment show \
  --resource-group aitax-rg \
  --name aitax-app
```

## Security Best Practices

1. **Never commit `.env.local`** - Use Azure Key Vault for production
2. **Use managed identities** - Avoid storing credentials
3. **Enable SSL** - Always use `sslmode=require` for PostgreSQL
4. **Rotate keys** - Regular rotation of API keys and secrets
5. **Monitor logs** - Set up alerts for errors
6. **Backup regularly** - Test restore procedures

## Support

For issues:
1. Check logs: `az webapp log tail`
2. Review Prisma logs: Check console output
3. Test API endpoints with Postman
4. Check Application Insights for errors
