import { NextRequest, NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'

const COMPANY_ID = 1

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const showRecent = searchParams.get('recent') === 'true' // Default to show all unreconciled
    const includeAll = searchParams.get('includeAll') === 'true' // Include reconciled transactions too

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

    // Helper to parse Xero's ASP.NET date format: /Date(1234567890000+0000)/
    const parseXeroDate = (dateStr: string): string => {
      if (!dateStr) return ''
      const match = dateStr.match(/\/Date\((\d+)([+-]\d+)?\)\//)
      if (match) {
        const timestamp = parseInt(match[1])
        return new Date(timestamp).toISOString()
      }
      return dateStr
    }

    // Calculate date filter - only show transactions from the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const dateFilter = sixMonthsAgo.toISOString().split('T')[0]

    // Build query for bank transactions
    // Get AUTHORISED transactions that are NOT yet reconciled (unless includeAll is true)
    // Status AUTHORISED = active transaction (not deleted)
    // IsReconciled false = not yet matched to bank statement line
    let whereClause = includeAll
      ? `Status=="AUTHORISED"`
      : `Status=="AUTHORISED" AND IsReconciled==false`

    // Always filter by date when showing all transactions (to avoid too many results)
    if (showRecent || includeAll) {
      whereClause += ` AND Date>=DateTime(${sixMonthsAgo.getFullYear()},${sixMonthsAgo.getMonth() + 1},${sixMonthsAgo.getDate()})`
    }

    if (accountId) {
      whereClause += ` AND BankAccount.AccountID=Guid("${accountId}")`
    }

    const url = `https://api.xero.com/api.xro/2.0/BankTransactions?where=${encodeURIComponent(whereClause)}&order=Date DESC`

    console.log('Fetching bank transactions:', url)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Xero API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch bank transactions from Xero' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Map transactions to useful format
    const transactions = data.BankTransactions?.map((tx: any) => ({
      transactionId: tx.BankTransactionID,
      type: tx.Type,
      date: parseXeroDate(tx.Date),
      reference: tx.Reference,
      status: tx.Status,
      isReconciled: tx.IsReconciled,
      bankAccount: {
        accountId: tx.BankAccount?.AccountID,
        name: tx.BankAccount?.Name,
        code: tx.BankAccount?.Code,
      },
      contact: tx.Contact ? {
        contactId: tx.Contact.ContactID,
        name: tx.Contact.Name,
      } : null,
      lineItems: tx.LineItems?.map((item: any) => ({
        description: item.Description,
        quantity: item.Quantity,
        unitAmount: item.UnitAmount,
        lineAmount: item.LineAmount,
        accountCode: item.AccountCode,
        taxType: item.TaxType,
      })) || [],
      subTotal: tx.SubTotal,
      totalTax: tx.TotalTax,
      total: tx.Total,
      currencyCode: tx.CurrencyCode,
    })) || []

    // Count unreconciled for display
    const unreconciledCount = transactions.filter((tx: any) => !tx.isReconciled).length

    return NextResponse.json({
      transactions: transactions,
      totalCount: transactions.length,
      unreconciledCount: unreconciledCount,
      includeAll: includeAll,
      dateFilter: dateFilter,
      note: transactions.length === 0
        ? includeAll
          ? 'No coded bank transactions found in the last 6 months.'
          : 'No unreconciled coded bank transactions found. Note: This shows coded transactions that haven\'t been reconciled to bank statement lines. The actual bank feed items you see in Xero\'s reconciliation screen are not available via the API.'
        : undefined
    })
  } catch (error: any) {
    console.error('Error fetching bank transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bank transactions' },
      { status: 500 }
    )
  }
}
