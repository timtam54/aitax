import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId: companyIdParam } = await params
    const companyId = parseInt(companyIdParam)

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'Invalid company ID' },
        { status: 400 }
      )
    }

    const token = await prisma.xeroToken.findUnique({
      where: { companyId }
    })

    if (!token) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      )
    }

    // Return token data (sensitive fields handled by client)
    return NextResponse.json({
      id: token.id,
      companyId: token.companyId,
      client_id: token.clientId,
      client_secret: token.clientSecret,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      tenant_id: token.tenantId,
      tenant_name: token.tenantName,
      tenant_type: token.tenantType,
      scope: token.scope,
      expires_at: token.expiresAt,
    })
  } catch (error) {
    console.error('Error fetching token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
