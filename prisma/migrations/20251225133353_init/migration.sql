-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_tokens" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "tenant_id" TEXT,
    "tenant_name" TEXT,
    "tenant_type" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'payroll.employees payroll.timesheets accounting.settings accounting.attachments accounting.transactions accounting.contacts payroll.settings offline_access',
    "expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "xero_tokens_companyId_key" ON "xero_tokens"("companyId");

-- AddForeignKey
ALTER TABLE "xero_tokens" ADD CONSTRAINT "xero_tokens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
