"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload, Loader2, AlertCircle, CheckCircle, Sparkles, Send, ArrowLeft, Trash2, Filter, Users } from "lucide-react"
import AdaptiveLayout from "@/components/adaptive-layout"
import Link from "next/link"

interface Transaction {
  id: number
  bankAccount: string
  bankAccountNumber: string
  date: string
  payee: string
  particulars: string | null
  spent: number | null
  received: number | null
  tax: string | null
  comments: string | null
  accountCode: string | null
  accountName: string | null
  status: string
  // For UI
  selected?: boolean
}

interface XeroAccount {
  code: string
  name: string
  type: string
  accountId: string
}

interface BankAccount {
  accountId: string
  name: string
  code: string
  bankAccountNumber: string
}

export default function ImportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<XeroAccount[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isParsing, setIsParsing] = useState(false)
  const [isCoding, setIsCoding] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitResults, setSubmitResults] = useState<{ created: number; failed: number } | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'wage'>('pending')

  // Load data on mount
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filter = filterMode === 'wage' ? '?filter=wage' : filterMode === 'pending' ? '?status=pending' : ''
      const [accountsRes, bankAccountsRes, txnsRes] = await Promise.all([
        fetch('/api/xero/accounts'),
        fetch('/api/xero/bank-accounts'),
        fetch(`/api/import/transactions${filter}`)
      ])

      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccounts(data.accounts || [])
      }

      if (bankAccountsRes.ok) {
        const data = await bankAccountsRes.json()
        setBankAccounts(data.bankAccounts || [])
      }

      if (txnsRes.ok) {
        const data = await txnsRes.json()
        // Add selected = true by default for pending
        const txns = (data.transactions || []).map((t: Transaction) => ({
          ...t,
          selected: t.status === 'pending'
        }))
        setTransactions(txns)
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filterMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    setError(null)
    setSuccess(null)
    setSubmitResults(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import/parse', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to parse CSV')
      }

      const data = await response.json()
      setSuccess(data.message)

      // Reload transactions from database
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV')
    } finally {
      setIsParsing(false)
    }
  }

  const suggestCoding = useCallback(async () => {
    if (!transactions.length) return

    setIsCoding(true)
    setError(null)

    try {
      // Apply coding rules and update in database
      const updates: { id: number; accountCode: string; accountName: string; status: string }[] = []

      for (const t of transactions) {
        if (t.status !== 'pending') continue

        const payee = t.payee.toUpperCase()
        const particulars = t.particulars?.toUpperCase() || ''

        let suggestedCode = ''
        let suggestedName = ''
        let status = 'coded'

        // Common expense patterns
        if (payee.includes('CLAUDE') || payee.includes('OPENAI') || payee.includes('MICROSOFT') || payee.includes('XERO')) {
          suggestedCode = '461'
          suggestedName = 'Subscriptions'
        } else if (payee.includes('DODO') || particulars.includes('UTL')) {
          suggestedCode = '445'
          suggestedName = 'Telephone & Internet'
        } else if (payee.includes('INTEREST')) {
          suggestedCode = '425'
          suggestedName = 'Interest Expense'
        } else if (payee.includes('FEE') || particulars.includes('FEE')) {
          suggestedCode = '404'
          suggestedName = 'Bank Fees'
        } else if (payee.includes('TRANSFER') || payee.includes('REIMBURSE')) {
          suggestedCode = ''
          suggestedName = 'Skip - Internal Transfer'
          status = 'skipped'
        } else if (payee.includes('PAYMENT RECEIVED')) {
          suggestedCode = ''
          suggestedName = 'Skip - CC Payment'
          status = 'skipped'
        } else if (particulars.includes('WAGE') || particulars.includes('NPP')) {
          suggestedCode = '477'
          suggestedName = 'Wages and Salaries'
        }

        // Try to match with actual accounts
        if (suggestedCode) {
          const matchedAccount = accounts.find(a => a.code === suggestedCode)
          if (matchedAccount) {
            suggestedName = matchedAccount.name
          }
        }

        if (suggestedCode || status === 'skipped') {
          updates.push({
            id: t.id,
            accountCode: suggestedCode,
            accountName: suggestedName,
            status
          })
        }
      }

      // Update in database
      for (const update of updates) {
        await fetch('/api/import/transactions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        })
      }

      setSuccess(`Applied coding suggestions to ${updates.length} transactions`)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to suggest coding')
    } finally {
      setIsCoding(false)
    }
  }, [transactions, accounts, loadData])

  const handleAccountChange = async (id: number, accountCode: string) => {
    const account = accounts.find(a => a.code === accountCode)

    await fetch('/api/import/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        accountCode,
        accountName: account?.name || '',
        status: accountCode ? 'coded' : 'pending'
      })
    })

    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, accountCode, accountName: account?.name || '', status: accountCode ? 'coded' : 'pending' } : t
    ))
  }

  const toggleSelected = (id: number) => {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, selected: !t.selected } : t
    ))
  }

  const selectAll = (selected: boolean) => {
    setTransactions(prev => prev.map(t => ({ ...t, selected })))
  }

  const matchBankAccount = (csvAccountNumber: string): string | null => {
    for (const ba of bankAccounts) {
      if (ba.bankAccountNumber && csvAccountNumber) {
        if (ba.bankAccountNumber.includes(csvAccountNumber) ||
            csvAccountNumber.includes(ba.bankAccountNumber) ||
            ba.bankAccountNumber.replace(/\D/g, '') === csvAccountNumber.replace(/\D/g, '')) {
          return ba.accountId
        }
      }
    }
    return null
  }

  const handleSubmitToXero = async () => {
    const selected = transactions.filter(t => t.selected && t.accountCode && t.status === 'coded')

    if (!selected.length) {
      setError('No coded transactions selected')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSubmitResults(null)

    try {
      const toCreate = selected.map(t => {
        const bankAccountId = matchBankAccount(t.bankAccountNumber)

        if (!bankAccountId) {
          throw new Error(`Could not match bank account: ${t.bankAccount} (${t.bankAccountNumber})`)
        }

        return {
          bankAccountId,
          date: t.date.split('T')[0],
          amount: t.spent || t.received || 0,
          description: `${t.payee} - ${t.particulars || ''}`,
          contactName: t.payee,
          accountCode: t.accountCode!,
          reference: t.particulars || '',
          type: t.spent ? 'SPEND' : 'RECEIVE' as 'SPEND' | 'RECEIVE'
        }
      })

      const response = await fetch('/api/xero/create-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: toCreate })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create transactions')
      }

      setSubmitResults({ created: result.created, failed: result.failed })

      if (result.created > 0) {
        setSuccess(`Created ${result.created} transactions in Xero`)

        // Update status to 'pushed' for created transactions
        for (const s of result.success) {
          const txn = selected.find(t =>
            t.date.split('T')[0] === s.transaction.date &&
            t.accountCode === s.transaction.accountCode
          )
          if (txn) {
            await fetch('/api/import/transactions', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: txn.id,
                status: 'pushed'
              })
            })
          }
        }

        await loadData()
      }

      if (result.failed > 0) {
        console.error('Failed transactions:', result.errors)
        setError(`${result.failed} transactions failed. Check console for details.`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit to Xero')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all imported transactions?')) return

    try {
      await fetch('/api/import/transactions?clearAll=true', { method: 'DELETE' })
      setTransactions([])
      setSuccess('All transactions cleared')
    } catch (err: any) {
      setError(err.message || 'Failed to clear transactions')
    }
  }

  const selectedCount = transactions.filter(t => t.selected).length
  const codedCount = transactions.filter(t => t.accountCode && t.status === 'coded').length
  const pendingCount = transactions.filter(t => t.status === 'pending').length

  return (
    <AdaptiveLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-semibold text-gray-900">Import Bank Transactions</h1>
            </div>
            <p className="text-sm text-gray-600">
              Upload a Xero Statement Lines CSV to code and push transactions to Xero
            </p>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-center">
                  {isParsing ? (
                    <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  )}
                  <p className="mt-2 text-sm text-gray-600">
                    {isParsing ? 'Parsing CSV...' : 'Click to upload Statement Lines CSV'}
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isParsing}
              />
            </label>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-6 py-3 text-sm font-medium ${filterMode === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-6 py-3 text-sm font-medium ${filterMode === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setFilterMode('wage')}
              className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${filterMode === 'wage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Filter className="h-4 w-4" />
              Wage Transactions (Payrun)
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-600">Loading transactions...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Actions Bar */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {selectedCount} selected / {codedCount} coded / {transactions.length} total
                </span>
                <button
                  onClick={() => selectAll(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
                <button
                  onClick={() => selectAll(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Deselect All
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
                <button
                  onClick={suggestCoding}
                  disabled={isCoding || isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {isCoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Suggest Coding
                </button>
                <button
                  onClick={handleSubmitToXero}
                  disabled={isSubmitting || codedCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Push to Xero ({codedCount})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input
                        type="checkbox"
                        checked={selectedCount === transactions.length && transactions.length > 0}
                        onChange={(e) => selectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spent</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                    {filterMode === 'wage' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payrun</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className={`${txn.selected ? 'bg-blue-50' : ''} ${txn.status === 'pushed' || txn.status === 'skipped' || txn.status === 'payrun_created' ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={txn.selected}
                          onChange={() => toggleSelected(txn.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          txn.status === 'pushed' ? 'bg-green-100 text-green-700' :
                          txn.status === 'payrun_created' ? 'bg-purple-100 text-purple-700' :
                          txn.status === 'coded' ? 'bg-blue-100 text-blue-700' :
                          txn.status === 'skipped' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {txn.status === 'payrun_created' ? 'payrun' : txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate" title={txn.bankAccount}>
                        {txn.bankAccount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {new Date(txn.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={txn.payee}>
                        {txn.payee}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate" title={txn.particulars || ''}>
                        {txn.particulars}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right whitespace-nowrap">
                        {txn.spent ? `$${txn.spent.toFixed(2)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right whitespace-nowrap">
                        {txn.received ? `$${txn.received.toFixed(2)}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        {txn.status === 'pushed' || txn.status === 'skipped' || txn.status === 'payrun_created' ? (
                          <span className="text-sm text-gray-500 italic">{txn.accountName || txn.status}</span>
                        ) : (
                          <select
                            value={txn.accountCode || ''}
                            onChange={(e) => handleAccountChange(txn.id, e.target.value)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select account...</option>
                            {accounts.map(acc => (
                              <option key={acc.code} value={acc.code}>
                                {acc.code} - {acc.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      {filterMode === 'wage' && (
                        <td className="px-4 py-3">
                          {txn.status === 'payrun_created' ? (
                            <span className="text-xs text-green-600 font-medium">Payrun Created</span>
                          ) : (
                            <Link
                              href={`/payrun?importId=${txn.id}&amount=${txn.spent || 0}&date=${txn.date.split('T')[0]}&reference=${encodeURIComponent(txn.payee + ' - ' + (txn.particulars || ''))}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700"
                            >
                              <Users className="h-3 w-3" />
                              Create Payrun
                            </Link>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Submit Results */}
            {submitResults && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                  {submitResults.created > 0 && (
                    <span className="text-sm text-green-600">
                      {submitResults.created} transactions created in Xero
                    </span>
                  )}
                  {submitResults.failed > 0 && (
                    <span className="text-sm text-red-600">
                      {submitResults.failed} transactions failed
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Upload className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No transactions loaded</h3>
            <p className="mt-2 text-sm text-gray-600">
              Upload a Statement Lines CSV from Xero to get started
            </p>
          </div>
        )}
      </div>
    </AdaptiveLayout>
  )
}
