import { XeroClient, TokenSet } from 'xero-node'
import { prisma } from './prisma'

/**
 * Get Xero client for a company with automatic token refresh
 */
export async function getXeroClient(companyId: number): Promise<XeroClient | null> {
  try {
    const token = await prisma.xeroToken.findUnique({
      where: { companyId }
    })

    if (!token || !token.clientId || !token.clientSecret) {
      console.error('No Xero credentials found for company:', companyId)
      return null
    }

    const xero = new XeroClient({
      clientId: token.clientId,
      clientSecret: token.clientSecret,
      redirectUris: [process.env.NEXT_PUBLIC_XERO_REDIR || 'http://localhost:3000/api/xero/callback'],
      scopes: token.scope.split(' '),
    })

    if (token.accessToken && token.refreshToken) {
      const tokenSet = {
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt ? Math.floor(token.expiresAt.getTime() / 1000) : undefined,
      } as TokenSet

      await xero.setTokenSet(tokenSet)

      // Check if token needs refresh (refresh 5 minutes before expiry)
      const shouldRefresh = token.expiresAt && token.expiresAt < new Date(Date.now() + 5 * 60 * 1000)

      if (shouldRefresh) {
        console.log('Token expiring soon, refreshing...')
        const newTokenSet = await xero.refreshToken()

        // Update token in database
        await prisma.xeroToken.update({
          where: { companyId },
          data: {
            accessToken: newTokenSet.access_token,
            refreshToken: newTokenSet.refresh_token,
            expiresAt: newTokenSet.expires_at ? new Date(newTokenSet.expires_at * 1000) : null,
          }
        })
      }
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
export async function getActiveTenantId(companyId: number): Promise<string | null> {
  const token = await prisma.xeroToken.findUnique({
    where: { companyId }
  })

  return token?.tenantId || null
}

// Note: We work directly with Xero API - no local data syncing
// All transaction coding, reconciliation, and reporting happens via Xero API calls
