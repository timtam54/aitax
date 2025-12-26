# Supabase Setup Guide (FREE Tier)

Supabase provides a free PostgreSQL database - perfect for storing just Xero tokens!

## Why Supabase?

- ✅ **Free tier** - 500MB database, plenty for tokens
- ✅ **No firewall configuration** - Works over internet
- ✅ **PostgreSQL** - Same as we use locally
- ✅ **No code changes** - Just update connection string
- ✅ **Great UI** - Easy to view and manage data
- ✅ **Auto backups** - Point-in-time recovery

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (easiest)

## Step 2: Create New Project

1. Click "New Project"
2. Fill in details:
   - **Name**: aitax (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Australia Southeast (Sydney) - closest to you
   - **Pricing Plan**: Free (perfect for your needs)
3. Click "Create new project"
4. Wait 2 minutes for setup

## Step 3: Get Connection String

1. In your Supabase project, click "Settings" (gear icon)
2. Click "Database" in the sidebar
3. Scroll to **Connection string** section
4. Select **URI** tab
5. Copy the connection string (looks like):

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

6. Replace `[YOUR-PASSWORD]` with the password you created in Step 2

## Step 4: Update .env.local

Replace your DATABASE_URL in `.env.local`:

```env
# Replace this line:
DATABASE_URL="postgresql://postgres:password@localhost:5432/aitax?schema=public"

# With your Supabase connection string:
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

## Step 5: Run Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Create tables in Supabase
npx prisma migrate dev --name init
```

## Step 6: Verify Setup

```bash
# Open Prisma Studio to view your Supabase database
npx prisma studio
```

You should see your empty `companies` and `xero_tokens` tables!

## Step 7: Test the App

```bash
npm run dev
```

Go to http://localhost:3000 and connect to Xero. Your tokens will now be stored in Supabase!

---

## Viewing Your Data

**Option 1: Supabase Dashboard**
1. Go to your Supabase project
2. Click "Table Editor" in sidebar
3. View `companies` and `xero_tokens` tables

**Option 2: Prisma Studio (Recommended)**
```bash
npx prisma studio
```

---

## Free Tier Limits

| Resource | Limit | Your Usage |
|----------|-------|------------|
| Database Size | 500 MB | ~1 MB (tokens only) ✅ |
| Bandwidth | 5 GB | Minimal ✅ |
| API Requests | Unlimited | ✅ |

**You'll never hit the limits!** Each company token is ~2KB. You could store 250,000 companies on the free tier! 😄

---

## Security Best Practices

1. **Use connection pooling** (automatic with Supabase)
2. **Never commit .env.local** (already in .gitignore)
3. **Rotate database password** if compromised
4. **Enable Row Level Security** (optional, for multi-tenant):

```sql
-- In Supabase SQL Editor
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies (example)
CREATE POLICY "Enable read access for authenticated users"
  ON companies FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## Troubleshooting

### "Can't connect to database"

1. Check your connection string is correct
2. Verify password doesn't have special characters (wrap in quotes if needed)
3. Make sure Supabase project is not paused (free tier auto-pauses after 7 days inactivity)

### "Relation does not exist"

Run migrations:
```bash
npx prisma migrate deploy
```

### "Too many connections"

Supabase free tier has connection pooling - this shouldn't happen. If it does:
```bash
# Add to connection string
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
```

---

## Deploying to Azure with Supabase

When deploying your Next.js app to Azure App Service:

1. **Add DATABASE_URL to Azure App Settings**:
```bash
az webapp config appsettings set \
  --resource-group aitax-rg \
  --name aitax-app \
  --settings DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

2. **Run migrations from Azure**:
```bash
# SSH into Azure App Service or use deployment script
DATABASE_URL="..." npx prisma migrate deploy
```

3. **That's it!** Azure App Service can connect to Supabase (no firewall needed)

---

## Cost Comparison

| Option | Monthly Cost (AUD) |
|--------|-------------------|
| Supabase Free | **$0** ✅ |
| Azure PostgreSQL (cheapest) | $15-20 |
| Supabase Pro (if you outgrow free) | $30 |

---

## Upgrading Later

If you ever need more (unlikely!):

**Supabase Pro ($25 USD/month):**
- 8 GB database
- 250 GB bandwidth
- Daily backups
- Point-in-time recovery

**But you won't need it for storing tokens!** 😊

---

## Next Steps

✅ Supabase setup complete!

Now you can:
1. Deploy to Azure App Service (~$25 AUD/month)
2. Keep using Supabase Free (no extra cost)
3. **Total cost: ~$25 AUD/month** for the entire app! 🎉

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Community**: https://github.com/supabase/supabase/discussions
- **Need help?** Check Prisma docs: https://www.prisma.io/docs
