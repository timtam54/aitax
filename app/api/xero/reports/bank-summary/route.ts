import { NextRequest, NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'

const COMPANY_ID = 1

export async function GET(request: NextRequest) {
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

    // Get date range - last 6 months
    const toDate = new Date()
    const fromDate = new Date()
    fromDate.setMonth(fromDate.getMonth() - 6)

    const fromDateStr = fromDate.toISOString().split('T')[0]
    const toDateStr = toDate.toISOString().split('T')[0]

    // Try Bank Summary report
    const url = `https://api.xero.com/api.xro/2.0/Reports/BankSummary?fromDate=${fromDateStr}&toDate=${toDateStr}`

    console.log('Fetching Bank Summary report:', url)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Bank Summary report error:', response.status, errorText)
      return NextResponse.json({
        error: 'Failed to fetch Bank Summary report',
        status: response.status,
        details: errorText
      }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Error fetching Bank Summary report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch report' },
      { status: 500 }
    )
  }
}
