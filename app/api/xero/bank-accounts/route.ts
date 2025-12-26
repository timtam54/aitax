import { NextRequest, NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

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

    // Fetch bank accounts from Xero
    // Using the Xero API directly for more control
    const tokenSet = await xero.readTokenSet()
    const accessToken = tokenSet.access_token

    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/Accounts?where=Type=="BANK"',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-Tenant-Id': tenantId,
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Xero API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch bank accounts from Xero' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Return bank accounts with relevant fields
    const bankAccounts = data.Accounts?.map((account: any) => ({
      accountId: account.AccountID,
      name: account.Name,
      code: account.Code,
      type: account.Type,
      bankAccountNumber: account.BankAccountNumber,
      bankAccountType: account.BankAccountType,
      currencyCode: account.CurrencyCode,
      status: account.Status,
    })) || []

    return NextResponse.json({ bankAccounts })
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bank accounts' },
      { status: 500 }
    )
  }
}
