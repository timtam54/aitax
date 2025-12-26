import { NextRequest, NextResponse } from 'next/server'
import { XeroClient } from 'xero-node'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // companyId

    if (!code || !state) {
      return NextResponse.redirect(new URL('/xero?error=missing_params', request.url))
    }

    const companyId = parseInt(state)
    if (isNaN(companyId)) {
      return NextResponse.redirect(new URL('/xero?error=invalid_company', request.url))
    }

    // Get token from database
    const token = await prisma.xeroToken.findUnique({
      where: { companyId }
    })

    if (!token || !token.clientId || !token.clientSecret) {
      return NextResponse.redirect(new URL('/xero?error=no_credentials', request.url))
    }

    // Initialize Xero client
    const xero = new XeroClient({
      clientId: token.clientId,
      clientSecret: token.clientSecret,
      redirectUris: [process.env.NEXT_PUBLIC_XERO_REDIR || 'http://localhost:3000/xero/callback'],
      scopes: token.scope?.split(' ') || [],
    })

    // Exchange code for token
    const tokenSet = await xero.apiCallback(request.url)

    // Get tenant connections
    const tokenSetWithConnections = await xero.updateTenants()
    const activeTenant = tokenSetWithConnections[0]

    // Update token in database
    await prisma.xeroToken.update({
      where: { companyId },
      data: {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        tenantId: activeTenant?.tenantId,
        tenantName: activeTenant?.tenantName,
        tenantType: activeTenant?.tenantType,
        expiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : null,
      }
    })

    // Redirect back to Xero page with success message
    return NextResponse.redirect(new URL('/xero?success=connected', request.url))
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/xero?error=callback_failed', request.url))
  }
}
