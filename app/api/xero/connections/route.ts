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
      const errorText = await response.text()
      console.error('Token refresh failed:', errorText)
      return null
    }

    const tokenData = await response.json()

    // Update token in database
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

    console.log('Token refreshed successfully')
    return tokenData.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

// GET: Fetch and update tenant connections from Xero
export async function GET() {
  try {
    // Get token from database
    let token = await prisma.xeroToken.findUnique({
      where: { companyId: COMPANY_ID }
    })

    if (!token || !token.accessToken) {
      return NextResponse.json({ error: 'No access token found' }, { status: 401 })
    }

    // Check if token is expired or expiring soon
    let accessToken = token.accessToken
    const isExpired = token.expiresAt && token.expiresAt < new Date(Date.now() + 60 * 1000) // 1 minute buffer

    if (isExpired && token.refreshToken) {
      console.log('Token expired, refreshing...')
      const newAccessToken = await refreshAccessToken(token)
      if (newAccessToken) {
        accessToken = newAccessToken
      } else {
        return NextResponse.json({
          error: 'Token expired and refresh failed. Please reconnect to Xero.',
          needsReconnect: true
        }, { status: 401 })
      }
    }

    // Fetch connections from Xero
    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!connectionsResponse.ok) {
      const errorText = await connectionsResponse.text()
      console.error('Connections API error:', errorText)
      return NextResponse.json({
        error: 'Failed to fetch connections from Xero',
        details: errorText
      }, { status: connectionsResponse.status })
    }

    const connections = await connectionsResponse.json()
    console.log('Xero connections:', JSON.stringify(connections, null, 2))

    if (connections.length === 0) {
      return NextResponse.json({
        error: 'No Xero organizations connected. Please reconnect and select an organization.',
        connections: []
      }, { status: 404 })
    }

    // Use the first connection (or you could let user choose)
    const firstConnection = connections[0]

    // Update token with tenant info
    await prisma.xeroToken.update({
      where: { companyId: COMPANY_ID },
      data: {
        tenantId: firstConnection.tenantId,
        tenantName: firstConnection.tenantName,
        tenantType: firstConnection.tenantType,
      }
    })

    return NextResponse.json({
      success: true,
      tenant: {
        tenantId: firstConnection.tenantId,
        tenantName: firstConnection.tenantName,
        tenantType: firstConnection.tenantType,
      },
      allConnections: connections
    })
  } catch (error: any) {
    console.error('Error fetching connections:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}
