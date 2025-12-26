# Deployment Cost Breakdown

## Recommended Setup: ~$25 AUD/month 💰

### What You're Paying For

| Service | What It Does | Cost (AUD) |
|---------|-------------|------------|
| **Azure App Service (B1)** | Hosts your Next.js application | ~$25/month |
| **Supabase (Free Tier)** | PostgreSQL for storing OAuth tokens | **$0/month** ✅ |
| **OpenAI API** | AI transaction coding (pay-per-use) | ~$1-5/month |
| **Total** | | **~$26-30/month** |

---

## What You Get for $25/month

### Azure App Service (B1 Tier)
- **1 CPU core** - Enough for your app
- **1.75 GB RAM** - More than enough
- **10 GB storage** - Plenty
- **Custom domain** - Use your own domain
- **SSL certificate** - Free HTTPS
- **99.95% uptime SLA** - Reliable

### Supabase Free Tier
- **500 MB database** - You'll use < 1 MB for tokens
- **Unlimited API requests** - No throttling
- **50,000 monthly active users** - More than enough
- **Daily backups** - Automatic
- **Realtime subscriptions** - If you need it later
- **Point-in-time recovery** - Last 7 days

---

## Storage Requirements

### What We Store:
```
Per company/client:
- Company name: 50 bytes
- Email: 50 bytes
- Xero Client ID: 40 bytes
- Xero Client Secret: 50 bytes
- Access Token: 500 bytes
- Refresh Token: 500 bytes
- Tenant info: 100 bytes
Total per company: ~1.3 KB
```

**For 100 clients: ~130 KB** (0.13 MB out of 500 MB free!)

You'd need **384,615 clients** to hit the Supabase free limit! 😂

---

## What We DON'T Store (Big Savings!)

We work directly with Xero API - no local storage needed for:

❌ Bank transactions
❌ Invoices
❌ Contacts
❌ Employees
❌ Payruns
❌ Historical data

**This saves you:**
- Database storage costs (GBs of data)
- Sync processing time
- Maintenance overhead
- Complex database queries

---

## OpenAI Cost Estimation

Using **GPT-4o-mini** (cheapest, perfect for this):

| Usage | Cost |
|-------|------|
| Input | $0.15 per 1M tokens |
| Output | $0.60 per 1M tokens |

**Typical transaction coding:**
- Input: ~200 tokens (transaction context)
- Output: ~100 tokens (account code + reasoning)
- Cost per transaction: **~$0.00008** (0.008 cents)

**For 1000 transactions/month**: ~$0.08 AUD 🎉

**For 10,000 transactions/month**: ~$0.80 AUD

---

## Comparison with Full Database Approach

| Approach | Database Cost | Sync Processing | Total Monthly |
|----------|---------------|-----------------|---------------|
| **Minimal (Our approach)** | $0 (Supabase free) | None (direct API) | **~$25-30** ✅ |
| Full data sync | $15-20 (Azure PostgreSQL) | ~$5 (compute time) | ~$45-50 |
| Enterprise setup | $50+ (larger DB) | $10+ (intensive sync) | $100+ |

**You save ~$20-70/month!**

---

## What If You Outgrow Free Tier?

### Supabase Pro: $25 USD (~$37 AUD)/month
- 8 GB database
- 250 GB bandwidth
- Point-in-time recovery (30 days)
- Custom domains

**But you won't need it!** Unless you have 6,000+ clients using the system daily.

---

## Azure App Service Tiers

If you need to scale later:

| Tier | Cost (AUD) | When You Need It |
|------|-----------|------------------|
| **B1** (Current) | $25 | < 1000 daily users ✅ |
| B2 | $50 | 1000-5000 users |
| B3 | $100 | 5000-10000 users |
| S1 | $95 | Need auto-scaling |
| P1V2 | $195 | Enterprise (10k+ users) |

---

## Cost Optimization Tips

### 1. Use Caching
Cache Xero API responses for 5-10 minutes:
```typescript
// Reduces API calls = saves time
// Your users won't notice the slight delay
```

### 2. Batch Operations
Process multiple transactions in one AI call:
```typescript
// Instead of: 100 transactions = 100 API calls
// Do: 100 transactions = 10 API calls (10 at a time)
// Saves ~90% on OpenAI costs
```

### 3. Regional Deployment
- Deploy to **Australia East** (Sydney)
- Supabase: **Australia Southeast** (Sydney)
- Xero servers: Australia
- **Result**: Faster + cheaper bandwidth

---

## Hidden Costs? NONE!

✅ No data transfer fees (within Azure)
✅ No egress charges (Supabase free tier)
✅ No surprise storage costs
✅ No minimum commitments
✅ No setup fees

---

## Annual Cost

| Monthly | Annual | Savings if Paid Annually |
|---------|--------|--------------------------|
| $25 | $300 | N/A (Azure bills monthly) |
| + OpenAI | ~$12-60 | - |
| **Total** | **~$312-360 AUD/year** | |

**That's less than $1 AUD per day!** ☕

---

## ROI for Your Business

If you charge clients for this service:

**Scenario 1: $10/month per client**
- 3 clients = $30/month revenue
- App costs = $25/month
- **Profit: $5/month** (covers OpenAI costs)

**Scenario 2: $50/month per client**
- 10 clients = $500/month revenue
- App costs = $25/month
- **Profit: $475/month** 🚀

**Scenario 3: One-time setup + quarterly service**
- Setup fee: $100/client
- Quarterly review: $200/client
- Annual revenue (10 clients): $9,000
- App costs: $300/year
- **Profit: $8,700/year** 💰

---

## Summary

**Your all-in cost: ~$25-30 AUD/month**

For that, you get:
- ✅ Full-stack Next.js app
- ✅ PostgreSQL database (Supabase)
- ✅ AI transaction coding (OpenAI)
- ✅ Xero integration
- ✅ 99.95% uptime
- ✅ HTTPS/SSL
- ✅ Auto backups
- ✅ Can serve 100s of clients

**This is incredibly cost-effective!** 🎉
