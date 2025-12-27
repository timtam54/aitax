import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const COMPANY_ID = 1

// Get the external base URL from headers (works on Azure)
function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const host = request.headers.get('host')
  if (host && !host.includes(':8080')) {
    return `https://${host}`
  }

  // Fallback to Azure app URL
  return 'https://aitax-app.azurewebsites.net'
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(new URL('/xero?error=missing_params', baseUrl))
    }

    // Get token from database
    const token = await prisma.xeroToken.findUnique({
      where: { companyId: COMPANY_ID }
    })

    if (!token || !token.clientId || !token.clientSecret) {
      return NextResponse.redirect(new URL('/xero?error=no_credentials', baseUrl))
    }

    const redirectUri = `${baseUrl}/api/xero/callback`

    // Exchange authorization code for tokens using Xero's token endpoint directly
    // This bypasses xero-node's PKCE validation which requires the same client instance
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${token.clientId}:${token.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }).toString()
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`)
    }

    const tokenData = await tokenResponse.json()

    // Get tenant connections
    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    let tenantId = null
    let tenantName = null
    let tenantType = null

    if (connectionsResponse.ok) {
      const connections = await connectionsResponse.json()
      console.log('Xero connections response:', JSON.stringify(connections, null, 2))
      if (connections.length > 0) {
        tenantId = connections[0].tenantId
        tenantName = connections[0].tenantName
        tenantType = connections[0].tenantType
        console.log('Selected tenant:', tenantId, tenantName)
      } else {
        console.log('No connections returned from Xero')
      }
    } else {
      const errorText = await connectionsResponse.text()
      console.error('Failed to fetch Xero connections:', connectionsResponse.status, errorText)
    }

    // Calculate expiry time
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null

    // Update token in database
    await prisma.xeroToken.update({
      where: { companyId: COMPANY_ID },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tenantId,
        tenantName,
        tenantType,
        expiresAt,
      }
    })

    // Redirect back to Xero page with success message
    return NextResponse.redirect(new URL('/xero?success=connected', baseUrl))
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)

    // Return error details in URL for debugging
    const errorMsg = encodeURIComponent(error?.message || 'unknown_error')
    return NextResponse.redirect(new URL(`/xero?error=callback_failed&details=${errorMsg}`, baseUrl))
  }
}
