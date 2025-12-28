import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const COMPANY_ID = 1

interface ParsedTransaction {
  bankAccount: string
  bankAccountNumber: string
  date: string
  payee: string
  particulars: string
  spent: number | null
  received: number | null
  tax: string | null
  comments: string | null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const transactions = parseXeroStatementLinesCSV(text)

    // Save to database (upsert by date + payee + amount to avoid duplicates)
    const saved = []
    for (const txn of transactions) {
      const existing = await prisma.importBankUnreconciled.findFirst({
        where: {
          companyId: COMPANY_ID,
          date: new Date(txn.date),
          payee: txn.payee,
          spent: txn.spent,
          received: txn.received,
          bankAccountNumber: txn.bankAccountNumber,
        }
      })

      if (!existing) {
        const created = await prisma.importBankUnreconciled.create({
          data: {
            companyId: COMPANY_ID,
            bankAccount: txn.bankAccount,
            bankAccountNumber: txn.bankAccountNumber,
            date: new Date(txn.date),
            payee: txn.payee,
            particulars: txn.particulars || '',
            spent: txn.spent,
            received: txn.received,
            tax: txn.tax,
            comments: txn.comments,
            status: 'pending',
          }
        })
        saved.push(created)
      }
    }

    return NextResponse.json({
      parsed: transactions.length,
      saved: saved.length,
      message: `Parsed ${transactions.length} transactions, saved ${saved.length} new records`
    })
  } catch (error: any) {
    console.error('Error parsing CSV:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse CSV' }, { status: 500 })
  }
}

function parseXeroStatementLinesCSV(csvText: string): ParsedTransaction[] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line)
  const transactions: ParsedTransaction[] = []

  let currentBankAccount = ''
  let currentBankAccountNumber = ''
  let inDataSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if this is a bank account name line (no commas, not a header)
    if (!line.includes(',') && !line.startsWith('Date,')) {
      // This could be account name or account number
      if (currentBankAccount === '' || inDataSection) {
        currentBankAccount = line
        currentBankAccountNumber = ''
        inDataSection = false
      } else if (currentBankAccountNumber === '') {
        currentBankAccountNumber = line
      }
      continue
    }

    // Check if this is the header row
    if (line.startsWith('Date,Payee,')) {
      inDataSection = true
      continue
    }

    // Parse data row
    if (inDataSection && line.match(/^\d{4}-\d{2}-\d{2},/)) {
      const parsed = parseCSVLine(line)
      if (parsed.length >= 5) {
        const spent = parseAmount(parsed[3])
        const received = parseAmount(parsed[4])

        transactions.push({
          bankAccount: currentBankAccount,
          bankAccountNumber: currentBankAccountNumber,
          date: parsed[0],
          payee: parsed[1],
          particulars: parsed[2],
          spent,
          received,
          tax: parsed[5] || null,
          comments: parsed[6] || null,
        })
      }
    }
  }

  return transactions
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function parseAmount(value: string): number | null {
  if (!value || value.trim() === '') return null
  // Remove commas and parse
  const cleaned = value.replace(/,/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}
