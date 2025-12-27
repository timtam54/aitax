import { NextRequest, NextResponse } from 'next/server'
import { getXeroClient, getActiveTenantId } from '@/lib/xero'
import OpenAI from 'openai'

const COMPANY_ID = 1

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// POST: Get AI suggestions for matching transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { statementLine, existingTransactions } = body

    // Use AI to suggest matches
    const prompt = `You are a bank reconciliation assistant. Analyze this bank statement line and suggest the best matching transaction from the list.

Bank Statement Line:
- Date: ${statementLine.date}
- Description: ${statementLine.description}
- Amount: ${statementLine.amount}
- Reference: ${statementLine.reference || 'N/A'}

Existing Transactions to Match:
${existingTransactions.map((tx: any, i: number) => `
${i + 1}. Transaction ID: ${tx.transactionId}
   - Date: ${tx.date}
   - Contact: ${tx.contact?.name || 'Unknown'}
   - Description: ${tx.lineItems?.[0]?.description || 'N/A'}
   - Amount: ${tx.total}
   - Reference: ${tx.reference || 'N/A'}
`).join('')}

Respond with JSON only:
{
  "bestMatchIndex": <number or null if no match>,
  "confidence": <"high", "medium", "low", or "none">,
  "reason": "<brief explanation>",
  "suggestedAccountCode": "<if no match, suggest an account code>",
  "suggestedContact": "<if no match, suggest creating/using this contact name>"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful accounting assistant specialized in bank reconciliation.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const suggestion = JSON.parse(completion.choices[0].message.content || '{}')

    return NextResponse.json({ suggestion })
  } catch (error: any) {
    console.error('Error getting AI suggestions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get AI suggestions' },
      { status: 500 }
    )
  }
}

// PUT: Reconcile a transaction in Xero
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId, action } = body

    if (!transactionId) {
      return NextResponse.json(
        { error: 'transactionId is required' },
        { status: 400 }
      )
    }

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

    // Update the bank transaction to mark as reconciled
    // Note: In Xero, transactions are typically reconciled through bank statement lines
    // This would involve matching statement lines to transactions

    if (action === 'approve') {
      // Mark transaction as reconciled by updating its status
      const updateResponse = await fetch(
        `https://api.xero.com/api.xro/2.0/BankTransactions/${transactionId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Xero-Tenant-Id': tenantId,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            BankTransactions: [{
              BankTransactionID: transactionId,
              IsReconciled: true
            }]
          })
        }
      )

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error('Xero API error:', errorText)
        return NextResponse.json(
          { error: 'Failed to reconcile transaction' },
          { status: updateResponse.status }
        )
      }

      return NextResponse.json({ success: true, message: 'Transaction reconciled' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Error reconciling transaction:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reconcile transaction' },
      { status: 500 }
    )
  }
}
