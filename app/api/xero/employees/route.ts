import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const COMPANY_ID = 1

async function refreshAccessToken(token: any): Promise<string | null> {
  try {
    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${token.clientId}:${token.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }).toString()
    })

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text())
      return null
    }

    const tokenData = await response.json()

    await prisma.xeroToken.update({
      where: { companyId: COMPANY_ID },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
      }
    })

    return tokenData.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

export async function GET() {
  try {
    const token = await prisma.xeroToken.findUnique({
      where: { companyId: COMPANY_ID }
    })

    if (!token || !token.accessToken || !token.tenantId) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 })
    }

    // Check if token is expired
    let accessToken = token.accessToken
    const isExpired = token.expiresAt && token.expiresAt < new Date(Date.now() + 60 * 1000)

    if (isExpired && token.refreshToken) {
      const newAccessToken = await refreshAccessToken(token)
      if (newAccessToken) {
        accessToken = newAccessToken
      } else {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }
    }

    // Fetch employees from Xero Payroll AU API
    const response = await fetch(
      'https://api.xero.com/payroll.xro/1.0/Employees',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-Tenant-Id': token.tenantId,
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Xero Payroll API error:', errorText)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: response.status })
    }

    const data = await response.json()

    // Map employees with their bank account details
    const employees = data.Employees?.map((emp: any) => ({
      employeeId: emp.EmployeeID,
      firstName: emp.FirstName,
      lastName: emp.LastName,
      fullName: `${emp.FirstName} ${emp.LastName}`,
      email: emp.Email,
      status: emp.Status,
      bankAccounts: emp.BankAccounts?.map((ba: any) => ({
        accountName: ba.AccountName,
        bsb: ba.BSB,
        accountNumber: ba.AccountNumber,
        remainder: ba.Remainder,
        // Format for matching: BSB + Account Number
        formattedAccount: `${ba.BSB} ${ba.AccountNumber}`.replace(/-/g, ''),
      })) || [],
    })) || []

    return NextResponse.json({ employees })
  } catch (error: any) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
