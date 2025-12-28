import { NextRequest, NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'

const COMPANY_ID = 1

interface TransactionToCreate {
  bankAccountId: string
  date: string
  amount: number
  description: string
  contactName?: string
  accountCode: string
  reference?: string
  type: 'SPEND' | 'RECEIVE'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactions } = body as { transactions: TransactionToCreate[] }

    if (!transactions || !transactions.length) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    const xero = await getXeroClient(COMPANY_ID)
    if (!xero) {
      return NextResponse.json({ error: 'Failed to get Xero client' }, { status: 401 })
    }

    const tenantId = await getActiveTenantId(COMPANY_ID)
    if (!tenantId) {
      return NextResponse.json({ error: 'No active Xero tenant' }, { status: 401 })
    }

    const tokenSet = await xero.readTokenSet()
    const accessToken = tokenSet.access_token

    const results: { success: any[], errors: any[] } = { success: [], errors: [] }

    // Create transactions one at a time to handle errors gracefully
    for (const txn of transactions) {
      try {
        const bankTransaction = {
          Type: txn.type,
          BankAccount: { AccountID: txn.bankAccountId },
          Date: txn.date,
          LineItems: [{
            Description: txn.description,
            Quantity: 1,
            UnitAmount: Math.abs(txn.amount),
            AccountCode: txn.accountCode,
          }],
          Reference: txn.reference || '',
        }

        // Add contact if provided
        if (txn.contactName) {
          (bankTransaction as any).Contact = { Name: txn.contactName }
        }

        const response = await fetch('https://api.xero.com/api.xro/2.0/BankTransactions', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Xero-Tenant-Id': tenantId,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ BankTransactions: [bankTransaction] })
        })

        const data = await response.json()

        if (!response.ok || data.ErrorNumber) {
          results.errors.push({
            transaction: txn,
            error: data.Message || data.Elements?.[0]?.ValidationErrors?.[0]?.Message || 'Unknown error'
          })
        } else {
          results.success.push({
            transaction: txn,
            xeroId: data.BankTransactions?.[0]?.BankTransactionID
          })
        }
      } catch (error: any) {
        results.errors.push({
          transaction: txn,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      created: results.success.length,
      failed: results.errors.length,
      success: results.success,
      errors: results.errors
    })
  } catch (error: any) {
    console.error('Error creating transactions:', error)
    return NextResponse.json({ error: error.message || 'Failed to create transactions' }, { status: 500 })
  }
}
