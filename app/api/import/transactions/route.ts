import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const COMPANY_ID = 1

// GET - Fetch all transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, coded, pushed, skipped
    const filter = searchParams.get('filter') // 'wage' for payrun filter

    const where: any = { companyId: COMPANY_ID }

    if (status) {
      where.status = status
    }

    // Special filter for wage transactions (for Payrun integration)
    // Match where 'wage' is in Payee OR Details (particulars) AND Spent > 0
    if (filter === 'wage') {
      where.OR = [
        { payee: { contains: 'Wage', mode: 'insensitive' } },
        { particulars: { contains: 'Wage', mode: 'insensitive' } }
      ]
      where.spent = { not: null, gt: 0 }
    }

    const transactions = await prisma.importBankUnreconciled.findMany({
      where,
      orderBy: { date: 'desc' }
    })

    // Convert Decimal to number for JSON
    const formatted = transactions.map(t => ({
      ...t,
      spent: t.spent ? Number(t.spent) : null,
      received: t.received ? Number(t.received) : null,
    }))

    return NextResponse.json({ transactions: formatted })
  } catch (error: any) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch transactions' }, { status: 500 })
  }
}

// PUT - Update transaction(s)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ids, accountCode, accountName, status } = body

    // Single update
    if (id) {
      const updated = await prisma.importBankUnreconciled.update({
        where: { id },
        data: {
          ...(accountCode !== undefined && { accountCode }),
          ...(accountName !== undefined && { accountName }),
          ...(status !== undefined && { status }),
        }
      })

      return NextResponse.json({ transaction: updated })
    }

    // Bulk update
    if (ids && Array.isArray(ids)) {
      await prisma.importBankUnreconciled.updateMany({
        where: { id: { in: ids } },
        data: {
          ...(accountCode !== undefined && { accountCode }),
          ...(accountName !== undefined && { accountName }),
          ...(status !== undefined && { status }),
        }
      })

      return NextResponse.json({ updated: ids.length })
    }

    return NextResponse.json({ error: 'No id or ids provided' }, { status: 400 })
  } catch (error: any) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: error.message || 'Failed to update transaction' }, { status: 500 })
  }
}

// DELETE - Delete transaction(s)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const clearAll = searchParams.get('clearAll')

    if (clearAll === 'true') {
      const deleted = await prisma.importBankUnreconciled.deleteMany({
        where: { companyId: COMPANY_ID }
      })
      return NextResponse.json({ deleted: deleted.count })
    }

    if (id) {
      await prisma.importBankUnreconciled.delete({
        where: { id: parseInt(id) }
      })
      return NextResponse.json({ deleted: 1 })
    }

    return NextResponse.json({ error: 'No id provided' }, { status: 400 })
  } catch (error: any) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete transaction' }, { status: 500 })
  }
}
