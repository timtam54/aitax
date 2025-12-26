# Quick Start Guide

Get your AI Tax Assistant running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Supabase account (free) - https://supabase.com
- OpenAI API key - https://platform.openai.com/api-keys
- Xero developer account - https://developer.xero.com

## Step 1: Clone and Install

```bash
cd /path/to/aitax
npm install
```

## Step 2: Set Up Supabase (FREE Database)

Follow the **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** guide (takes 5 minutes):

1. Create free Supabase account
2. Create new project (wait 2 minutes)
3. Copy your connection string
4. Done! No firewall configuration needed

## Step 3: Configure Environment Variables

Edit `.env.local` and add:

```env
# Your Supabase connection string (from Step 2)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# Your OpenAI API key
OPENAI_API_KEY=sk-your-key-here

# Xero OAuth callback
NEXT_PUBLIC_XERO_REDIR=http://localhost:3000/api/xero/callback
```

## Step 4: Get Xero Credentials

1. Go to https://developer.xero.com/app/manage
2. Click "New app"
3. Fill in details:
   - App name: "AI Tax Assistant"
   - Integration type: "Web app"
   - Redirect URI: `http://localhost:3000/api/xero/callback`
4. Save and copy your **Client ID** and **Client Secret**

## Step 5: Create Database Tables

```bash
# Generate Prisma Client
npx prisma generate

# Create tables in Supabase
npx prisma migrate dev --name init
```

## Step 6: Start the App

```bash
npm run dev
```

Open http://localhost:3000

## Step 7: Connect to Xero

1. Click "Get Started" on the landing page
2. Click "Configure Connection" on the first task
3. Enter your Xero Client ID and Client Secret
4. Click "Save Credentials"
5. Click "Connect to Xero"
6. Authorize the app in the popup window

## You're Done!

Now you can:
- Sync data from Xero
- Reconcile bank transactions
- Use AI to code transactions
- Generate BAS reports

## Useful Commands

```bash
# View database
npm run db:studio

# Reset database (deletes all data)
npm run db:reset

# Generate Prisma Client (after schema changes)
npm run db:generate

# Create new migration
npm run db:migrate
```

## Troubleshooting

### Database connection error

1. Check your Supabase connection string is correct in `.env.local`
2. Verify your Supabase project is not paused (free tier auto-pauses after 7 days inactivity)
3. Go to Supabase dashboard and click "Resume project"

### Prisma Client errors

Regenerate the client:
```bash
npm run db:generate
```

### Port 3000 already in use

Kill the process or use a different port:
```bash
npm run dev -- -p 3001
```

### Can't connect to Xero

1. Check your Client ID and Secret
2. Verify redirect URI matches in Xero Developer Portal
3. Make sure you saved credentials before connecting

## Next Steps

- Read [README.md](./README.md) for detailed documentation
- Read [BACKEND_SETUP.md](./BACKEND_SETUP.md) for Azure deployment
- Open Prisma Studio to explore your database: `npm run db:studio`
