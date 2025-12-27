import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const COMPANY_ID = 1

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_id, client_secret, scope } = body

    // Check if company exists, create if not
    let company = await prisma.company.findUnique({
      where: { id: COMPANY_ID }
    })

    if (!company) {
      company = await prisma.company.create({
        data: {
          id: COMPANY_ID,
          name: `Company ${COMPANY_ID}`,
          email: `company${COMPANY_ID}@placeholder.local`
        }
      })
    }

    // Create new token
    const token = await prisma.xeroToken.create({
      data: {
        companyId: COMPANY_ID,
        clientId: client_id,
        clientSecret: client_secret,
        scope: scope || 'payroll.employees payroll.timesheets accounting.settings accounting.attachments accounting.transactions accounting.contacts accounting.reports.read payroll.settings offline_access',
      }
    })

    return NextResponse.json({
      id: token.id,
      companyId: token.companyId,
      client_id: token.clientId,
      client_secret: token.clientSecret,
      scope: token.scope,
    })
  } catch (error) {
    console.error('Error creating token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      client_id,
      client_secret,
      access_token,
      refresh_token,
      tenant_id,
      tenant_name,
      tenant_type,
      scope,
      expires_at
    } = body

    const updateData: any = {}

    if (client_id !== undefined) updateData.clientId = client_id
    if (client_secret !== undefined) updateData.clientSecret = client_secret
    if (access_token !== undefined) updateData.accessToken = access_token
    if (refresh_token !== undefined) updateData.refreshToken = refresh_token
    if (tenant_id !== undefined) updateData.tenantId = tenant_id
    if (tenant_name !== undefined) updateData.tenantName = tenant_name
    if (tenant_type !== undefined) updateData.tenantType = tenant_type
    if (scope !== undefined) updateData.scope = scope
    if (expires_at !== undefined) updateData.expiresAt = new Date(expires_at)

    const token = await prisma.xeroToken.update({
      where: { companyId: COMPANY_ID },
      data: updateData
    })

    return NextResponse.json({
      id: token.id,
      companyId: token.companyId,
      client_id: token.clientId,
      client_secret: token.clientSecret,
      access_token: token.accessToken,
      tenant_id: token.tenantId,
      tenant_name: token.tenantName,
      tenant_type: token.tenantType,
      scope: token.scope,
      expires_at: token.expiresAt,
    })
  } catch (error) {
    console.error('Error updating token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const token = await prisma.xeroToken.findUnique({
      where: { companyId: COMPANY_ID }
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
