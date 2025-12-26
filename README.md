# AI Tax Assistant

An AI-powered application that connects to your Xero accounting file to automate quarterly activity statement preparation and tax return processing.

## Features

- **Xero Integration**: OAuth-based connection to your Xero accounting file
- **Direct Xero API Access**: Work directly with Xero data (no local database syncing needed)
- **AI Transaction Coding**: Use OpenAI to automatically suggest account codes for transactions
- **Bank Reconciliation**: Reconcile bank statements directly in Xero
- **Payrun Verification**: Check staff payments have associated payruns
- **Activity Statement Reports**: Pull reports from Xero for BAS preparation
- **myGov Business Guide**: Step-by-step instructions for completing your activity statement with the ATO
- **Minimal Storage**: Only stores Xero OAuth tokens (not all your accounting data)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase free tier recommended - see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))
- A Xero account with developer access
- OpenAI API key (for AI transaction coding)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up PostgreSQL database:

**Using Docker (Recommended for local development):**
```bash
docker run --name aitax-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=aitax \
  -p 5432:5432 \
  -d postgres:15
```

**Or install PostgreSQL locally** from https://www.postgresql.org/download/

3. Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

4. Configure your environment variables in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/aitax?schema=public"
NEXT_PUBLIC_XERO_REDIR=http://localhost:3000/api/xero/callback
OPENAI_API_KEY=your_openai_api_key_here
```

5. Run database migrations:

```bash
# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma migrate dev --name init
```

### Setting up Xero OAuth

1. Go to the [Xero Developer Portal](https://developer.xero.com/app/manage)
2. Create a new app or select an existing one
3. Configure your app:
   - **App Type**: Web app
   - **Redirect URI**: `http://localhost:3000/xero/callback` (for development)
4. Copy the **Client ID** and generate a **Client Secret**
5. Save these credentials - you'll need them when setting up the connection in the app

### Running the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Connect to Xero

- Navigate to the dashboard
- Click "Configure Connection" on the first task
- Enter your Xero Client ID and Client Secret
- Click "Save Credentials"
- Click "Connect to Xero" to authorize the application

### 2. Complete Tasks in Order

The dashboard shows 6 tasks that should be completed sequentially:

1. **Connect to Xero** - Set up OAuth integration
2. **Reconcile Bank Statements** - Match and reconcile transactions
3. **Code All Transactions** - Categorize unmatched transactions
4. **Verify Staff Payruns** - Ensure all payments have payruns
5. **Generate Activity Statement Reports** - Extract BAS data from Xero
6. **Complete ATO Activity Statement** - Lodge with myGov Business

Each task is locked until the previous one is completed.

## Project Structure

```
aitax/
├── app/
│   ├── api/                # Next.js API Routes
│   │   ├── token/         # Token CRUD operations
│   │   └── xero/          # Xero OAuth callback
│   ├── dashboard/         # Main dashboard page
│   ├── xero/             # Xero connection page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Landing page
├── components/           # React components
├── lib/                  # Utilities
│   ├── prisma.ts        # Prisma client
│   └── xero.ts          # Xero API helpers
├── prisma/
│   └── schema.prisma    # Database schema (just 2 tables!)
└── interface/           # TypeScript types
```

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Authentication**: Xero OAuth 2.0

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXT_PUBLIC_XERO_REDIR` | OAuth callback URL for Xero | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key (alternative) | No |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | No |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure OpenAI deployment | No |

## Development

The application uses a **full-stack Next.js architecture** with:
- Next.js API Routes for backend logic
- PostgreSQL database with Prisma ORM
- Xero Node SDK for API integration
- OpenAI for AI-powered transaction coding

### Database Management

```bash
# View/edit data with Prisma Studio
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name migration_name

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset
```

## Security Notes

- Never commit your `.env.local` file to version control
- Client secrets should be stored securely
- In production, always use HTTPS for OAuth callbacks
- Consider implementing proper backend token storage for production use

## Deployment

### Recommended: Azure + Supabase

**Total Cost: ~$25 AUD/month** 🎉

1. **Supabase (Free Tier)** - PostgreSQL database
   - See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for setup
   - $0/month (free tier is plenty for tokens)

2. **Azure App Service** - Host Next.js app
   - See **[BACKEND_SETUP.md](./BACKEND_SETUP.md)** for deployment
   - ~$25 AUD/month (B1 tier)

### Vercel (Alternative)

You can also deploy to Vercel:
1. Connect your GitHub repository
2. Add environment variables (including DATABASE_URL)
3. Deploy automatically on push

**Note**: You'll still need a PostgreSQL database (use Vercel Postgres or Azure Database for PostgreSQL).

## API Endpoints

### Token Management
- `GET /api/token/[companyId]` - Get Xero OAuth token for a company
- `POST /api/token` - Create new company and token
- `PUT /api/token` - Update token (refresh tokens, credentials)

### OAuth
- `GET /api/xero/callback` - Handle Xero OAuth callback and store tokens

**Note**: All Xero operations (transactions, reconciliation, reports) happen directly via Xero API using the stored tokens. No data syncing required!

## Architecture

```
┌─────────────────────────────────────────┐
│         Next.js Frontend                │
│  (Dashboard, Xero Connection, Tasks)    │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│       Next.js API Routes                │
│  (Token CRUD, OAuth Callback)           │
└──────┬──────────────────────────────────┘
       │
       ├──────────────────┐
       │                  │
┌──────▼─────────┐  ┌─────▼──────────────────┐
│   Supabase     │  │  External Services     │
│  (FREE Tier)   │  │  ┌──────────────────┐  │
│                │  │  │ Xero API         │  │
│ - Companies    │  │  │ (All data lives  │  │
│ - OAuth Tokens │  │  │  here - we just  │  │
│   (2 tables)   │  │  │  call their API) │  │
│                │  │  └──────────────────┘  │
│  ~1 MB total   │  │  ┌──────────────────┐  │
└────────────────┘  │  │ OpenAI API       │  │
                    │  │ (AI coding)      │  │
                    │  └──────────────────┘  │
                    └────────────────────────┘

💰 Total Storage: < 1 MB (just tokens!)
💰 Total Cost: ~$25 AUD/month (Azure App Service only)
```
