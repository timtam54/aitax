import { NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'

const COMPANY_ID = 1

export async function GET() {
  try {
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

    // Fetch chart of accounts
    const response = await fetch('https://api.xero.com/api.xro/2.0/Accounts', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Accounts fetch error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: response.status })
    }

    const data = await response.json()

    // Filter to expense and revenue accounts that can be used for coding
    const codingAccounts = data.Accounts?.filter((acc: any) =>
      ['EXPENSE', 'REVENUE', 'DIRECTCOSTS', 'OVERHEADS', 'OTHERINCOME'].includes(acc.Type) &&
      acc.Status === 'ACTIVE'
    ).map((acc: any) => ({
      code: acc.Code,
      name: acc.Name,
      type: acc.Type,
      accountId: acc.AccountID,
    })) || []

    return NextResponse.json({ accounts: codingAccounts })
  } catch (error: any) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch accounts' }, { status: 500 })
  }
}
