import { NextRequest, NextResponse } from 'next/server'
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

async function getAccessToken() {
  const token = await prisma.xeroToken.findUnique({
    where: { companyId: COMPANY_ID }
  })

  if (!token || !token.accessToken || !token.tenantId) {
    return null
  }

  let accessToken = token.accessToken
  const isExpired = token.expiresAt && token.expiresAt < new Date(Date.now() + 60 * 1000)

  if (isExpired && token.refreshToken) {
    const newAccessToken = await refreshAccessToken(token)
    if (newAccessToken) {
      accessToken = newAccessToken
    } else {
      return null
    }
  }

  return { accessToken, tenantId: token.tenantId }
}

// GET: Fetch pay calendars and pay run templates
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employeeId')

    const auth = await getAccessToken()
    if (!auth) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 })
    }

    // Fetch pay calendars
    const calendarsResponse = await fetch(
      'https://api.xero.com/payroll.xro/1.0/PayrollCalendars',
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Xero-Tenant-Id': auth.tenantId,
          'Accept': 'application/json',
        }
      }
    )

    let payrollCalendars = []
    if (calendarsResponse.ok) {
      const data = await calendarsResponse.json()
      payrollCalendars = data.PayrollCalendars || []
    }

    // If employeeId provided, get employee's pay template
    let employeePayTemplate = null
    if (employeeId) {
      const empResponse = await fetch(
        `https://api.xero.com/payroll.xro/1.0/Employees/${employeeId}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Xero-Tenant-Id': auth.tenantId,
            'Accept': 'application/json',
          }
        }
      )

      if (empResponse.ok) {
        const empData = await empResponse.json()
        const employee = empData.Employees?.[0]
        if (employee) {
          employeePayTemplate = {
            payTemplate: employee.PayTemplate,
            taxDeclaration: employee.TaxDeclaration,
            superMemberships: employee.SuperMemberships,
            bankAccounts: employee.BankAccounts,
            ordinaryEarningsRateID: employee.OrdinaryEarningsRateID,
          }
        }
      }
    }

    return NextResponse.json({ payrollCalendars, employeePayTemplate })
  } catch (error: any) {
    console.error('Error fetching payroll data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Calculate pay run OR create pay run in Xero
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      employeeId,
      netPayAmount,
      payrollCalendarId,
      payPeriodEndDate,
      createPayrun = false, // If true, actually create the payrun in Xero
      estimatedEarnings: providedEarnings,
    } = body

    if (!employeeId || !netPayAmount) {
      return NextResponse.json({
        error: 'employeeId and netPayAmount are required'
      }, { status: 400 })
    }

    const auth = await getAccessToken()
    if (!auth) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 })
    }

    // First, get employee details to understand their pay structure
    const empResponse = await fetch(
      `https://api.xero.com/payroll.xro/1.0/Employees/${employeeId}`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Xero-Tenant-Id': auth.tenantId,
          'Accept': 'application/json',
        }
      }
    )

    if (!empResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 400 })
    }

    const empData = await empResponse.json()
    const employee = empData.Employees?.[0]

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Calculate earnings to achieve target net pay
    const superPercentage = 11.5 // Current SG rate
    const estimatedTaxRate = 0.27 // Approximate for mid-range income

    const estimatedEarnings = providedEarnings || Math.round(netPayAmount / (1 - estimatedTaxRate) * 100) / 100
    const estimatedTax = Math.round((estimatedEarnings * estimatedTaxRate) * 100) / 100
    const estimatedSuper = Math.round((estimatedEarnings * superPercentage / 100) * 100) / 100

    // Get the earnings rate ID from employee or use default
    const earningsRateId = employee.OrdinaryEarningsRateID
    let calendarId = payrollCalendarId || employee.PayrollCalendarID

    // Calculate pay period end date
    const endDate = payPeriodEndDate || getNextPayPeriodEnd(calendarId, auth)

    // If createPayrun is true, actually create the pay run in Xero
    if (createPayrun) {
      // Check if the calendar is outdated (dates in the past)
      const calendarOutdated = await isCalendarOutdated(calendarId, auth)
      if (calendarOutdated) {
        console.log('Calendar is outdated, creating new calendar with current dates...')
        const newCalendarId = await createCurrentPayrollCalendar(auth)
        if (newCalendarId) {
          console.log('Created new calendar:', newCalendarId)

          // Update employee to use the new calendar
          const updateEmployeePayload = [{
            EmployeeID: employeeId,
            PayrollCalendarID: newCalendarId,
          }]

          console.log('Updating employee with new calendar:', JSON.stringify(updateEmployeePayload, null, 2))

          const updateEmpResponse = await fetch(
            'https://api.xero.com/payroll.xro/1.0/Employees',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Xero-Tenant-Id': auth.tenantId,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify(updateEmployeePayload)
            }
          )

          const updateEmpText = await updateEmpResponse.text()
          console.log('Employee update response:', updateEmpResponse.status, updateEmpText)

          if (updateEmpResponse.ok) {
            calendarId = newCalendarId
            console.log('Employee assigned to new calendar successfully')
          } else {
            console.error('Failed to update employee calendar, using old calendar')
          }
        } else {
          console.error('Failed to create new calendar, using old one')
        }
      }

      // Step 1: Create the PayRun
      // Note: Xero AU Payroll API expects an array of pay runs
      const payRunPayload = [{
        PayrollCalendarID: calendarId,
        PayRunStatus: 'DRAFT',
      }]

      console.log('Creating PayRun with payload:', JSON.stringify(payRunPayload, null, 2))

      const createPayRunResponse = await fetch(
        'https://api.xero.com/payroll.xro/1.0/PayRuns',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Xero-Tenant-Id': auth.tenantId,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payRunPayload)
        }
      )

      const payRunResponseText = await createPayRunResponse.text()
      console.log('PayRun response:', createPayRunResponse.status, payRunResponseText)

      if (!createPayRunResponse.ok) {
        return NextResponse.json({
          error: 'Failed to create pay run in Xero',
          details: payRunResponseText
        }, { status: createPayRunResponse.status })
      }

      const payRunData = JSON.parse(payRunResponseText)
      const payRun = payRunData.PayRuns?.[0]

      if (!payRun) {
        return NextResponse.json({
          error: 'Pay run created but no data returned',
          details: payRunResponseText
        }, { status: 500 })
      }

      // Step 2: Fetch the full PayRun details to get Payslips
      // The creation response doesn't include Payslips array, so we need to GET it
      console.log('Fetching PayRun details for:', payRun.PayRunID)

      const payRunDetailsResponse = await fetch(
        `https://api.xero.com/payroll.xro/1.0/PayRuns/${payRun.PayRunID}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Xero-Tenant-Id': auth.tenantId,
            'Accept': 'application/json',
          }
        }
      )

      let payslip = null
      if (payRunDetailsResponse.ok) {
        const payRunDetails = await payRunDetailsResponse.json()
        const fullPayRun = payRunDetails.PayRuns?.[0]
        console.log('PayRun details - Payslips count:', fullPayRun?.Payslips?.length)
        payslip = fullPayRun?.Payslips?.find((p: any) => p.EmployeeID === employeeId)
        if (payslip) {
          console.log('Found payslip for employee:', payslip.PayslipID)
        }
      } else {
        console.error('Failed to fetch PayRun details:', await payRunDetailsResponse.text())
      }

      if (payslip) {
        // Update the payslip with the calculated earnings
        // For single payslip update by ID, Xero expects a single Payslip object (not array)
        const updatePayslipPayload = {
          Payslip: {
            PayslipID: payslip.PayslipID,
            EmployeeID: employeeId,
            EarningsLines: [{
              EarningsRateID: earningsRateId,
              NumberOfUnits: 1,
              RatePerUnit: estimatedEarnings,
            }]
          }
        }

        console.log('Updating Payslip with payload:', JSON.stringify(updatePayslipPayload, null, 2))

        const updatePayslipResponse = await fetch(
          `https://api.xero.com/payroll.xro/1.0/Payslip/${payslip.PayslipID}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Xero-Tenant-Id': auth.tenantId,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(updatePayslipPayload)
          }
        )

        const updateResponseText = await updatePayslipResponse.text()
        console.log('Update payslip response:', updatePayslipResponse.status, updateResponseText)

        if (!updatePayslipResponse.ok) {
          console.error('Failed to update payslip earnings:', updateResponseText)
        }
      }

      return NextResponse.json({
        success: true,
        payrunCreated: true,
        payRun: {
          payRunId: payRun.PayRunID,
          payRunStatus: payRun.PayRunStatus,
          paymentDate: payRun.PaymentDate,
          payPeriodStartDate: payRun.PayPeriodStartDate,
          payPeriodEndDate: payRun.PayPeriodEndDate,
        },
        calculation: {
          targetNetPay: netPayAmount,
          estimatedEarnings,
          estimatedTax,
          estimatedSuper,
          totalCost: estimatedEarnings + estimatedSuper,
        },
        employee: {
          id: employee.EmployeeID,
          name: `${employee.FirstName} ${employee.LastName}`,
          payrollCalendarId: calendarId,
          earningsRateId: earningsRateId,
        },
        message: 'Pay run created in Xero! Review and post it in Xero to complete.',
        xeroDeepLink: `https://go.xero.com/payroll/payruns/${payRun.PayRunID}`
      })
    }

    // Just return the calculation (not creating yet)
    return NextResponse.json({
      success: true,
      payrunCreated: false,
      calculation: {
        targetNetPay: netPayAmount,
        estimatedEarnings,
        estimatedTax,
        estimatedSuper,
        totalCost: estimatedEarnings + estimatedSuper,
      },
      employee: {
        id: employee.EmployeeID,
        name: `${employee.FirstName} ${employee.LastName}`,
        payrollCalendarId: calendarId,
        earningsRateId: earningsRateId,
      },
      message: 'Pay run calculation ready. Click "Create Payrun in Xero" to proceed.',
      xeroDeepLink: `https://go.xero.com/payroll/payruns`
    })
  } catch (error: any) {
    console.error('Error creating pay run:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getNextFriday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
  const nextFriday = new Date(today)
  nextFriday.setDate(today.getDate() + daysUntilFriday)
  return nextFriday.toISOString().split('T')[0]
}

// Create a NEW PayrollCalendar with current dates (Xero doesn't allow updating calendar dates)
async function createCurrentPayrollCalendar(auth: { accessToken: string, tenantId: string }): Promise<string | null> {
  try {
    // Get most recent Monday as start date
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const startDate = new Date(today)
    startDate.setDate(today.getDate() + daysToMonday)

    // Payment date is the Friday of the same week
    const paymentDate = new Date(startDate)
    paymentDate.setDate(startDate.getDate() + 4) // Friday of same week

    const calendarPayload = [{
      Name: `Weekly - ${startDate.toISOString().split('T')[0]}`,
      CalendarType: 'WEEKLY',
      StartDate: startDate.toISOString().split('T')[0],
      PaymentDate: paymentDate.toISOString().split('T')[0],
    }]

    console.log('Creating NEW PayrollCalendar:', JSON.stringify(calendarPayload, null, 2))

    const response = await fetch(
      'https://api.xero.com/payroll.xro/1.0/PayrollCalendars',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Xero-Tenant-Id': auth.tenantId,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(calendarPayload)
      }
    )

    const responseText = await response.text()
    console.log('PayrollCalendar creation response:', response.status, responseText)

    if (response.ok) {
      const data = JSON.parse(responseText)
      return data.PayrollCalendars?.[0]?.PayrollCalendarID || null
    }

    return null
  } catch (error) {
    console.error('Error creating PayrollCalendar:', error)
    return null
  }
}

// Check if a calendar's next pay period is outdated
async function isCalendarOutdated(calendarId: string, auth: { accessToken: string, tenantId: string }): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.xero.com/payroll.xro/1.0/PayrollCalendars/${calendarId}`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Xero-Tenant-Id': auth.tenantId,
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) return true

    const data = await response.json()
    const calendar = data.PayrollCalendars?.[0]

    if (!calendar?.PaymentDate) return true

    // Parse Xero date format /Date(timestamp)/
    const match = calendar.PaymentDate.match(/\/Date\((\d+)([+-]\d+)?\)\//)
    if (match) {
      const paymentDate = new Date(parseInt(match[1]))
      const today = new Date()
      // If payment date is more than 30 days in the past, calendar is outdated
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      return paymentDate < thirtyDaysAgo
    }

    return false
  } catch (error) {
    console.error('Error checking calendar:', error)
    return true
  }
}

async function getNextPayPeriodEnd(calendarId: string, auth: { accessToken: string, tenantId: string }): Promise<string> {
  // Try to get the calendar to determine the correct pay period end date
  try {
    const response = await fetch(
      `https://api.xero.com/payroll.xro/1.0/PayrollCalendars/${calendarId}`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Xero-Tenant-Id': auth.tenantId,
          'Accept': 'application/json',
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      const calendar = data.PayrollCalendars?.[0]
      if (calendar?.PaymentDate) {
        // Parse Xero date format
        const match = calendar.PaymentDate.match(/\/Date\((\d+)([+-]\d+)?\)\//)
        if (match) {
          return new Date(parseInt(match[1])).toISOString().split('T')[0]
        }
      }
    }
  } catch (e) {
    console.error('Error fetching calendar:', e)
  }

  // Default to next Friday
  return getNextFriday()
}
