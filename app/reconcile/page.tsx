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
  Building2,
  Users,
  Info,
  ExternalLink,
  Filter,
  Search,
  DollarSign
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
  const [notConnected, setNotConnected] = useState(false)
  const [apiNote, setApiNote] = useState<string | null>(null)

  // Filter state
  const [activeFilter, setActiveFilter] = useState<"all" | "wage">("all")
  const [showFilterPopup, setShowFilterPopup] = useState(false)
  const [filterText, setFilterText] = useState("")
  const [appliedFilterText, setAppliedFilterText] = useState("")
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  useEffect(() => {
    fetchBankAccounts()
  }, [])

  // Apply filters when transactions or filter settings change
  useEffect(() => {
    let result = [...transactions]

    // Apply wage filter (only spend transactions - negative amounts)
    if (activeFilter === "wage") {
      result = result.filter(tx => tx.total < 0)
    }

    // Apply text search filter
    if (appliedFilterText) {
      const searchLower = appliedFilterText.toLowerCase()
      result = result.filter(tx => {
        const description = tx.lineItems[0]?.description?.toLowerCase() || ""
        const reference = tx.reference?.toLowerCase() || ""
        const contactName = tx.contact?.name?.toLowerCase() || ""
        return description.includes(searchLower) ||
               reference.includes(searchLower) ||
               contactName.includes(searchLower)
      })
    }

    setFilteredTransactions(result)
  }, [transactions, activeFilter, appliedFilterText])

  const fetchBankAccounts = async () => {
    try {
      setIsLoadingAccounts(true)
      setError(null)
      setNotConnected(false)

      const response = await fetch(`/api/xero/bank-accounts`)
      const data = await response.json()

      if (!response.ok) {
        if (data.notConnected) {
          setNotConnected(true)
        }
        throw new Error(data.error || "Failed to fetch bank accounts")
      }

      setBankAccounts(data.bankAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bank accounts")
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const fetchTransactions = async (accountId: string, includeAll: boolean = false) => {
    try {
      setIsLoadingTransactions(true)
      setError(null)
      setTransactions([])
      setApiNote(null)

      const url = includeAll
        ? `/api/xero/bank-transactions?accountId=${accountId}&includeAll=true`
        : `/api/xero/bank-transactions?accountId=${accountId}`
      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch transactions")
      }

      const data = await response.json()
      setTransactions(data.transactions)
      if (data.note) {
        setApiNote(data.note)
      }
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
    setActiveFilter("all")
    setFilterText("")
    setAppliedFilterText("")
    fetchTransactions(account.accountId, showAllTransactions)
  }

  const handleToggleShowAll = () => {
    const newValue = !showAllTransactions
    setShowAllTransactions(newValue)
    if (selectedAccount) {
      fetchTransactions(selectedAccount.accountId, newValue)
    }
  }

  const handleApplyFilter = () => {
    setAppliedFilterText(filterText)
    setShowFilterPopup(false)
  }

  const handleClearFilters = () => {
    setActiveFilter("all")
    setFilterText("")
    setAppliedFilterText("")
    setShowFilterPopup(false)
  }

  const getAISuggestion = async (transaction: Transaction) => {
    try {
      setLoadingAI(transaction.transactionId)

      const response = await fetch("/api/xero/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      setSuccessMessage("Transaction marked as reconciled")
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
          <h1 className="text-2xl font-semibold text-gray-900">Coded Bank Transactions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Review coded transactions that need to be matched to bank statement lines
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">What this shows</p>
              <p className="mb-2">
                This displays <strong>coded bank transactions</strong> from Xero. The raw bank feed items
                (statement lines from your bank connection) are not available via the Xero API.
              </p>
              <ul className="list-disc list-inside mb-2 space-y-1 text-xs">
                <li><strong>Unreconciled Only:</strong> Coded transactions waiting to be matched to bank statement lines</li>
                <li><strong>Show All Recent:</strong> All coded transactions from the last 6 months (158 transactions)</li>
              </ul>
              <a
                href="https://go.xero.com/Bank/BankAccounts.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Open Xero Bank Reconciliation (for bank feed items)
              </a>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
            {notConnected && (
              <div className="mt-3">
                <a
                  href="/xero"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Connect to Xero
                </a>
              </div>
            )}
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
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-900">
                    {selectedAccount
                      ? showAllTransactions
                        ? `All Recent Transactions - ${selectedAccount.name}`
                        : `Unreconciled Transactions - ${selectedAccount.name}`
                      : "Select a bank account"}
                  </h2>
                  {selectedAccount && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleToggleShowAll}
                        className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-md transition-colors ${
                          showAllTransactions
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {showAllTransactions ? "Show Unreconciled Only" : "Show All Recent"}
                      </button>
                      <button
                        onClick={() => fetchTransactions(selectedAccount.accountId, showAllTransactions)}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  )}
                </div>

                {/* Filter Buttons */}
                {selectedAccount && transactions.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 mr-1">Filter:</span>
                    <button
                      onClick={() => setActiveFilter("all")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                        activeFilter === "all"
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
                      }`}
                    >
                      All ({transactions.length})
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => {
                          setActiveFilter("wage")
                          setShowFilterPopup(true)
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors inline-flex items-center gap-1 ${
                          activeFilter === "wage"
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
                        }`}
                      >
                        <DollarSign className="h-3 w-3" />
                        Wage
                        {activeFilter === "wage" && (
                          <span className="ml-1">({filteredTransactions.length})</span>
                        )}
                      </button>

                      {/* Filter Popup */}
                      {showFilterPopup && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              <Filter className="h-4 w-4" />
                              Wage Filter Options
                            </h3>
                            <button
                              onClick={() => setShowFilterPopup(false)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Description contains:
                              </label>
                              <input
                                type="text"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                placeholder="e.g., ANZ, wage, salary"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Searches description, reference, and contact name
                              </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              <button
                                onClick={handleApplyFilter}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                              >
                                <Search className="h-4 w-4" />
                                Search
                              </button>
                              <button
                                onClick={handleClearFilters}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Show active filter indicator */}
                    {(activeFilter !== "all" || appliedFilterText) && (
                      <div className="flex items-center gap-2 ml-2">
                        {appliedFilterText && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                            "{appliedFilterText}"
                            <button
                              onClick={() => setAppliedFilterText("")}
                              className="hover:text-purple-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                        <button
                          onClick={handleClearFilters}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
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
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {transactions.length === 0 ? (
                      <>
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
                        <p className="font-medium text-green-600">All caught up!</p>
                        <p className="text-sm mt-1">No unreconciled coded transactions found</p>
                        {apiNote && (
                          <p className="text-xs text-gray-400 mt-3 max-w-md mx-auto">{apiNote}</p>
                        )}
                        <a
                          href="https://go.xero.com/Bank/BankAccounts.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Check bank feed in Xero
                        </a>
                      </>
                    ) : (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium text-gray-600">No matching transactions</p>
                        <p className="text-sm mt-1">Try adjusting your filter criteria</p>
                        <button
                          onClick={handleClearFilters}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          Clear all filters
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 mb-4">
                      Showing {filteredTransactions.length} {activeFilter === "wage" ? "wage " : ""}transaction{filteredTransactions.length !== 1 ? 's' : ''}{appliedFilterText ? ` matching "${appliedFilterText}"` : ""} from the last 6 months
                    </p>
                    {filteredTransactions.map((tx) => (
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
                              {formatCurrency(Math.abs(tx.total), tx.currencyCode)}
                            </div>
                            <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                              <span>{tx.type}</span>
                              {showAllTransactions && (
                                <span className={`px-1.5 py-0.5 rounded ${
                                  tx.isReconciled
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}>
                                  {tx.isReconciled ? "Reconciled" : "Unreconciled"}
                                </span>
                              )}
                            </div>
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
                                      {item.accountCode && (
                                        <span className="text-gray-500 ml-2">
                                          ({item.accountCode})
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-medium">
                                      {formatCurrency(Math.abs(item.lineAmount), tx.currencyCode)}
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
                            <div className="flex items-center gap-3 flex-wrap">
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
                                Mark as Reconciled
                              </button>
                              {tx.type === "SPEND" && Math.abs(tx.total) > 100 && (
                                <button
                                  onClick={() => {
                                    window.location.href = `/payrun?transactionId=${tx.transactionId}&amount=${tx.total}&date=${encodeURIComponent(tx.date)}&reference=${encodeURIComponent(tx.reference || '')}`
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                                >
                                  <Users className="h-4 w-4" />
                                  Create Payrun
                                </button>
                              )}
                              <a
                                href={`https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=${tx.transactionId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View in Xero
                              </a>
                              <button
                                onClick={() => setExpandedTx(null)}
                                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                              >
                                <X className="h-4 w-4" />
                                Close
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
