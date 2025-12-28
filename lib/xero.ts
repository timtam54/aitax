import { XeroClient, TokenSet } from 'xero-node'
import { prisma } from './prisma'

const COMPANY_ID = 1

/**
 * Refresh token using direct HTTP call to Xero identity endpoint
 */
async function refreshAccessToken(token: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
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

    return await response.json()
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

/**
 * Get Xero client for a company with automatic token refresh
 */
export async function getXeroClient(companyId: number = COMPANY_ID): Promise<XeroClient | null> {
  try {
    const token = await prisma.xeroToken.findUnique({
      where: { companyId }
    })

    if (!token || !token.clientId || !token.clientSecret) {
      console.error('No Xero credentials found for company:', companyId)
      return null
    }

    let accessToken = token.accessToken
    let refreshToken = token.refreshToken

    // Check if token needs refresh (refresh 5 minutes before expiry)
    const shouldRefresh = token.expiresAt && token.expiresAt < new Date(Date.now() + 5 * 60 * 1000)

    if (shouldRefresh && token.refreshToken) {
      console.log('Token expiring soon, refreshing...')
      const newTokenData = await refreshAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
        refreshToken: token.refreshToken,
      })

      if (newTokenData) {
        // Update token in database
        await prisma.xeroToken.update({
          where: { companyId },
          data: {
            accessToken: newTokenData.access_token,
            refreshToken: newTokenData.refresh_token,
            expiresAt: new Date(Date.now() + newTokenData.expires_in * 1000),
          }
        })
        console.log('Token refreshed successfully')
        accessToken = newTokenData.access_token
        refreshToken = newTokenData.refresh_token
      } else {
        console.error('Token refresh failed, continuing with existing token')
      }
    }

    const xero = new XeroClient({
      clientId: token.clientId,
      clientSecret: token.clientSecret,
      redirectUris: [process.env.NEXT_PUBLIC_XERO_REDIR || 'http://localhost:3000/api/xero/callback'],
      scopes: token.scope.split(' '),
    })

    if (accessToken && refreshToken) {
      const tokenSet = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: token.expiresAt ? Math.floor(token.expiresAt.getTime() / 1000) : undefined,
      } as TokenSet

      await xero.setTokenSet(tokenSet)
    }

    return xero
  } catch (error) {
    console.error('Error getting Xero client:', error)
    return null
  }
}

/**
 * Get active tenant ID for a company
 */
export async function getActiveTenantId(companyId: number = COMPANY_ID): Promise<string | null> {
  const token = await prisma.xeroToken.findUnique({
    where: { companyId }
  })

  return token?.tenantId || null
}

// Note: We work directly with Xero API - no local data syncing
// All transaction coding, reconciliation, and reporting happens via Xero API calls
