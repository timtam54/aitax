#!/bin/bash

echo "🚀 AI Tax Assistant - Setup Script"
echo "===================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from template..."
  cp .env.local.example .env.local
  echo "✅ Created .env.local - please update with your credentials!"
  echo ""
  echo "You need to set:"
  echo "  - DATABASE_URL (PostgreSQL connection string)"
  echo "  - OPENAI_API_KEY (from https://platform.openai.com/api-keys)"
  echo ""
else
  echo "✅ .env.local already exists"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "⚠️  Docker is not running. Please start Docker to run PostgreSQL."
  echo ""
  read -p "Do you want to continue without Docker? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo "✅ Docker is running"

  # Check if PostgreSQL container exists
  if [ ! "$(docker ps -a -q -f name=aitax-postgres)" ]; then
    echo "🐘 Starting PostgreSQL container..."
    docker run --name aitax-postgres \
      -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=aitax \
      -p 5432:5432 \
      -d postgres:15

    echo "⏳ Waiting for PostgreSQL to start..."
    sleep 5
    echo "✅ PostgreSQL container started"
  else
    echo "✅ PostgreSQL container already exists"

    # Start container if it's not running
    if [ ! "$(docker ps -q -f name=aitax-postgres)" ]; then
      echo "▶️  Starting existing PostgreSQL container..."
      docker start aitax-postgres
      sleep 3
    fi
  fi
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Generating Prisma Client..."
npx prisma generate

echo ""
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your credentials"
echo "2. Get Xero OAuth credentials from https://developer.xero.com/app/manage"
echo "3. Get OpenAI API key from https://platform.openai.com/api-keys"
echo "4. Run: npm run dev"
echo "5. Open: http://localhost:3000"
echo ""
echo "To view/edit database: npx prisma studio"
