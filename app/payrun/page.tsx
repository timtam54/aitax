"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Users,
  DollarSign,
  Calculator,
  ExternalLink,
  User,
  Plus
} from "lucide-react"
import AdaptiveLayout from "@/components/adaptive-layout"

interface Employee {
  employeeId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  status: string
  bankAccounts: {
    accountName: string
    bsb: string
    accountNumber: string
    formattedAccount: string
  }[]
}

interface PayRunCalculation {
  targetNetPay: number
  estimatedEarnings: number
  estimatedTax: number
  estimatedSuper: number
  totalCost: number
}

interface PayRunData {
  payRunId: string
  payRunStatus: string
  paymentDate: string
  payPeriodStartDate: string
  payPeriodEndDate: string
}

function PayrunContent() {
  const searchParams = useSearchParams()
  const transactionId = searchParams.get("transactionId")
  const transactionAmount = parseFloat(searchParams.get("amount") || "0")
  const transactionDate = searchParams.get("date")
  const transactionReference = searchParams.get("reference")

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isCreatingPayrun, setIsCreatingPayrun] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<PayRunCalculation | null>(null)
  const [xeroLink, setXeroLink] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [payrunCreated, setPayrunCreated] = useState(false)
  const [payRunData, setPayRunData] = useState<PayRunData | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setIsLoadingEmployees(true)
      setError(null)

      const response = await fetch(`/api/xero/employees`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch employees")
      }

      setEmployees(data.employees.filter((e: Employee) => e.status === "ACTIVE"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employees")
    } finally {
      setIsLoadingEmployees(false)
    }
  }

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee)
    setCalculation(null)
    setSuccess(false)
    setPayrunCreated(false)
    setPayRunData(null)
  }

  const calculatePayrun = async () => {
    if (!selectedEmployee || !transactionAmount) return

    try {
      setIsCalculating(true)
      setError(null)

      const response = await fetch("/api/xero/payrun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.employeeId,
          netPayAmount: Math.abs(transactionAmount),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate payrun")
      }

      setCalculation(data.calculation)
      setXeroLink(data.xeroDeepLink)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate payrun")
    } finally {
      setIsCalculating(false)
    }
  }

  const createPayrunInXero = async () => {
    if (!selectedEmployee || !calculation) return

    try {
      setIsCreatingPayrun(true)
      setError(null)

      const response = await fetch("/api/xero/payrun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.employeeId,
          netPayAmount: Math.abs(transactionAmount),
          estimatedEarnings: calculation.estimatedEarnings,
          createPayrun: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to create payrun in Xero")
      }

      // Mark the original bank transaction as reconciled
      if (transactionId) {
        try {
          await fetch("/api/xero/reconcile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactionId,
              action: "approve",
            }),
          })
        } catch (reconcileErr) {
          console.error("Failed to mark transaction as reconciled:", reconcileErr)
          // Don't fail the whole operation if reconcile fails
        }
      }

      setPayrunCreated(true)
      setPayRunData(data.payRun)
      setXeroLink(data.xeroDeepLink)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payrun in Xero")
    } finally {
      setIsCreatingPayrun(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  if (isLoadingEmployees) {
    return (
      <AdaptiveLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading employees...</span>
          </div>
        </div>
      </AdaptiveLayout>
    )
  }

  return (
    <AdaptiveLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/reconcile"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Reconciliation
            </a>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Create Payrun</h1>
          <p className="text-sm text-gray-600 mt-1">
            Match bank transaction to employee and create a payrun
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Transaction Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Transaction Details
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-gray-500">Date</span>
              <p className="font-medium text-gray-900">{formatDate(transactionDate)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Reference</span>
              <p className="font-medium text-gray-900">{transactionReference || "No reference"}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Transaction ID</span>
              <p className="font-mono text-xs text-gray-600">{transactionId?.substring(0, 8) || "N/A"}...</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Amount (Net Pay Target)</span>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(Math.abs(transactionAmount))}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Employee
              </h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-sm text-gray-500">No active employees found</p>
              ) : (
                <div className="space-y-2">
                  {employees.map((employee) => (
                    <button
                      key={employee.employeeId}
                      onClick={() => handleEmployeeSelect(employee)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedEmployee?.employeeId === employee.employeeId
                          ? "bg-purple-50 border-purple-300 text-purple-900"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-200 rounded-full p-2">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium">{employee.fullName}</div>
                          {employee.bankAccounts.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Bank: {employee.bankAccounts[0].bsb} {employee.bankAccounts[0].accountNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payrun Calculation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Payrun Calculation
              </h2>
            </div>
            <div className="p-4">
              {!selectedEmployee ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Select an employee to calculate payrun</p>
                </div>
              ) : !calculation ? (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Selected Employee:</p>
                    <p className="font-medium text-lg">{selectedEmployee.fullName}</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Click below to calculate the earnings amount needed to achieve a net pay of{" "}
                      <strong>{formatCurrency(Math.abs(transactionAmount))}</strong>
                    </p>
                  </div>
                  <button
                    onClick={calculatePayrun}
                    disabled={isCalculating}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {isCalculating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Calculator className="h-5 w-5" />
                    )}
                    Calculate Payrun
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {payrunCreated ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-800 font-medium">Payrun Created in Xero!</span>
                      </div>
                      {payRunData && (
                        <p className="text-sm text-green-700">
                          Pay Run ID: {payRunData.payRunId.substring(0, 8)}... • Status: {payRunData.payRunStatus}
                        </p>
                      )}
                    </div>
                  ) : success && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-800 font-medium">Calculation Complete - Ready to Create</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Gross Earnings</span>
                      <span className="font-medium">{formatCurrency(calculation.estimatedEarnings)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">PAYG Tax (est.)</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(calculation.estimatedTax)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Superannuation (11.5%)</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(calculation.estimatedSuper)}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
                      <span className="font-semibold text-green-800">Net Pay</span>
                      <span className="font-bold text-green-600 text-lg">
                        {formatCurrency(calculation.targetNetPay)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 text-sm text-gray-500">
                      <span>Total Employment Cost</span>
                      <span>{formatCurrency(calculation.totalCost)}</span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    {!payrunCreated ? (
                      <>
                        <button
                          onClick={createPayrunInXero}
                          disabled={isCreatingPayrun}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {isCreatingPayrun ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Plus className="h-5 w-5" />
                          )}
                          {isCreatingPayrun ? "Creating Payrun..." : "Create Payrun in Xero"}
                        </button>
                        <p className="text-xs text-gray-500 text-center">
                          This will create a draft payrun in Xero with earnings of{" "}
                          <strong>{formatCurrency(calculation.estimatedEarnings)}</strong>
                        </p>
                      </>
                    ) : (
                      <>
                        <a
                          href={xeroLink || "https://go.xero.com/payroll/payruns"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="h-5 w-5" />
                          View Payrun in Xero
                        </a>
                        <p className="text-xs text-gray-500 text-center">
                          Review and post the payrun in Xero to complete the process.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  )
}

export default function PayrunPage() {
  return (
    <Suspense fallback={
      <AdaptiveLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </AdaptiveLayout>
    }>
      <PayrunContent />
    </Suspense>
  )
}
