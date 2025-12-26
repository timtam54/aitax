"use client"

import { useState, useEffect } from "react"
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Check,
  X,
  RefreshCw,
  ArrowLeft,
  Building2
} from "lucide-react"
import AdaptiveLayout from "@/components/adaptive-layout"

interface BankAccount {
  accountId: string
  name: string
  code: string
  type: string
  bankAccountNumber?: string
  bankAccountType?: string
  currencyCode: string
  status: string
}

interface LineItem {
  description: string
  quantity: number
  unitAmount: number
  lineAmount: number
  accountCode: string
  taxType: string
}

interface Transaction {
  transactionId: string
  type: string
  date: string
  reference: string
  status: string
  isReconciled: boolean
  bankAccount: {
    accountId: string
    name: string
    code: string
  }
  contact: {
    contactId: string
    name: string
  } | null
  lineItems: LineItem[]
  subTotal: number
  totalTax: number
  total: number
  currencyCode: string
}

interface AISuggestion {
  bestMatchIndex: number | null
  confidence: "high" | "medium" | "low" | "none"
  reason: string
  suggestedAccountCode?: string
  suggestedContact?: string
}

export default function ReconcilePage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestion>>({})
  const [loadingAI, setLoadingAI] = useState<string | null>(null)
  const [reconcilingTx, setReconcilingTx] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const companyId = typeof window !== "undefined" ? localStorage.getItem("companyid") : null

  useEffect(() => {
    if (companyId) {
      fetchBankAccounts()
    } else {
      setError("No company ID found. Please connect to Xero first.")
      setIsLoadingAccounts(false)
    }
  }, [companyId])

  const fetchBankAccounts = async () => {
    try {
      setIsLoadingAccounts(true)
      setError(null)

      const response = await fetch(`/api/xero/bank-accounts?companyId=${companyId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch bank accounts")
      }

      const data = await response.json()
      setBankAccounts(data.bankAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bank accounts")
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const fetchTransactions = async (accountId: string) => {
    try {
      setIsLoadingTransactions(true)
      setError(null)
      setTransactions([])

      const response = await fetch(
        `/api/xero/bank-transactions?companyId=${companyId}&accountId=${accountId}`
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch transactions")
      }

      const data = await response.json()
      setTransactions(data.transactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transactions")
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  const handleAccountSelect = (account: BankAccount) => {
    setSelectedAccount(account)
    setExpandedTx(null)
    setAiSuggestions({})
    fetchTransactions(account.accountId)
  }

  const getAISuggestion = async (transaction: Transaction) => {
    try {
      setLoadingAI(transaction.transactionId)

      const response = await fetch("/api/xero/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          statementLine: {
            date: transaction.date,
            description: transaction.lineItems[0]?.description || transaction.reference,
            amount: transaction.total,
            reference: transaction.reference,
          },
          existingTransactions: transactions.filter(
            (tx) => tx.transactionId !== transaction.transactionId
          ),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI suggestion")
      }

      const data = await response.json()
      setAiSuggestions((prev) => ({
        ...prev,
        [transaction.transactionId]: data.suggestion,
      }))
    } catch (err) {
      console.error("AI suggestion error:", err)
    } finally {
      setLoadingAI(null)
    }
  }

  const handleReconcile = async (transactionId: string) => {
    try {
      setReconcilingTx(transactionId)
      setError(null)

      const response = await fetch("/api/xero/reconcile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          transactionId,
          action: "approve",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to reconcile transaction")
      }

      // Remove from list and show success
      setTransactions((prev) =>
        prev.filter((tx) => tx.transactionId !== transactionId)
      )
      setSuccessMessage("Transaction reconciled successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconcile transaction")
    } finally {
      setReconcilingTx(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number, currency: string = "AUD") => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).format(amount)
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "text-green-600 bg-green-50"
      case "medium":
        return "text-yellow-600 bg-yellow-50"
      case "low":
        return "text-orange-600 bg-orange-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  if (isLoadingAccounts) {
    return (
      <AdaptiveLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading bank accounts...</span>
          </div>
        </div>
      </AdaptiveLayout>
    )
  }

  return (
    <AdaptiveLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/dashboard"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </a>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Bank Reconciliation</h1>
          <p className="text-sm text-gray-600 mt-1">
            Review and reconcile your bank transactions with AI assistance
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700">{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Bank Accounts Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Bank Accounts
                </h2>
              </div>
              <div className="p-2">
                {bankAccounts.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No bank accounts found</p>
                ) : (
                  <div className="space-y-1">
                    {bankAccounts.map((account) => (
                      <button
                        key={account.accountId}
                        onClick={() => handleAccountSelect(account)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedAccount?.accountId === account.accountId
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className="font-medium">{account.name}</div>
                        <div className="text-xs text-gray-500">{account.code}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-900">
                  {selectedAccount
                    ? `Unreconciled Transactions - ${selectedAccount.name}`
                    : "Select a bank account"}
                </h2>
                {selectedAccount && (
                  <button
                    onClick={() => fetchTransactions(selectedAccount.accountId)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                )}
              </div>

              <div className="p-4">
                {!selectedAccount ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Select a bank account to view transactions</p>
                  </div>
                ) : isLoadingTransactions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600">Loading transactions...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
                    <p className="font-medium text-green-600">All caught up!</p>
                    <p className="text-sm">No unreconciled transactions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.transactionId}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        {/* Transaction Header */}
                        <div
                          className="px-4 py-3 bg-gray-50 cursor-pointer flex items-center justify-between"
                          onClick={() =>
                            setExpandedTx(
                              expandedTx === tx.transactionId ? null : tx.transactionId
                            )
                          }
                        >
                          <div className="flex items-center gap-4">
                            {expandedTx === tx.transactionId ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {tx.contact?.name || tx.lineItems[0]?.description || "Unknown"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(tx.date)} • {tx.reference || "No reference"}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-sm font-medium ${
                                tx.total >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {formatCurrency(tx.total, tx.currencyCode)}
                            </div>
                            <div className="text-xs text-gray-500">{tx.type}</div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedTx === tx.transactionId && (
                          <div className="px-4 py-4 border-t border-gray-200 bg-white">
                            {/* Line Items */}
                            <div className="mb-4">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                                Line Items
                              </h4>
                              <div className="space-y-2">
                                {tx.lineItems.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0"
                                  >
                                    <div>
                                      <span className="text-gray-900">
                                        {item.description || "No description"}
                                      </span>
                                      <span className="text-gray-500 ml-2">
                                        ({item.accountCode})
                                      </span>
                                    </div>
                                    <span className="font-medium">
                                      {formatCurrency(item.lineAmount, tx.currencyCode)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* AI Suggestion */}
                            {aiSuggestions[tx.transactionId] ? (
                              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Sparkles className="h-4 w-4 text-purple-600" />
                                  <span className="text-sm font-medium text-purple-900">
                                    AI Suggestion
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(
                                      aiSuggestions[tx.transactionId].confidence
                                    )}`}
                                  >
                                    {aiSuggestions[tx.transactionId].confidence} confidence
                                  </span>
                                </div>
                                <p className="text-sm text-purple-700">
                                  {aiSuggestions[tx.transactionId].reason}
                                </p>
                                {aiSuggestions[tx.transactionId].suggestedAccountCode && (
                                  <p className="text-xs text-purple-600 mt-1">
                                    Suggested account:{" "}
                                    {aiSuggestions[tx.transactionId].suggestedAccountCode}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => getAISuggestion(tx)}
                                disabled={loadingAI === tx.transactionId}
                                className="mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-50"
                              >
                                {loadingAI === tx.transactionId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                Get AI Suggestion
                              </button>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleReconcile(tx.transactionId)}
                                disabled={reconcilingTx === tx.transactionId}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {reconcilingTx === tx.transactionId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Approve & Reconcile
                              </button>
                              <button
                                onClick={() => setExpandedTx(null)}
                                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                              >
                                <X className="h-4 w-4" />
                                Skip
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  )
}
