import { NextRequest, NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const accountId = searchParams.get('accountId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const companyIdNum = parseInt(companyId)
    if (isNaN(companyIdNum)) {
      return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 })
    }

    const xero = await getXeroClient(companyIdNum)
    if (!xero) {
      return NextResponse.json({ error: 'Failed to get Xero client' }, { status: 401 })
    }

    const tenantId = await getActiveTenantId(companyIdNum)
    if (!tenantId) {
      return NextResponse.json({ error: 'No active Xero tenant' }, { status: 401 })
    }

    const tokenSet = await xero.readTokenSet()
    const accessToken = tokenSet.access_token

    // Build query for bank transactions
    // Filter by account if provided, and get unreconciled transactions
    let url = 'https://api.xero.com/api.xro/2.0/BankTransactions?order=Date DESC'

    if (accountId) {
      url += `&where=BankAccount.AccountID=Guid("${accountId}")`
    }

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
      date: tx.Date,
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

    // Filter to show unreconciled transactions
    const unreconciledTransactions = transactions.filter((tx: any) => !tx.isReconciled)

    return NextResponse.json({
      transactions: unreconciledTransactions,
      totalCount: transactions.length,
      unreconciledCount: unreconciledTransactions.length
    })
  } catch (error: any) {
    console.error('Error fetching bank transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bank transactions' },
      { status: 500 }
    )
  }
}
