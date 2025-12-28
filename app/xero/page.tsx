"use client"

import { useState, useEffect } from "react"
import { Save, Edit3, AlertCircle, CheckCircle, Loader2, ExternalLink, HelpCircle } from "lucide-react"
import AdaptiveLayout from "@/components/adaptive-layout"
import XeroHelpPopup from "@/components/xero-help-popup"
import type Token from "@/interface/token"

const DEFAULT_SCOPE = "payroll.employees payroll.payruns payroll.timesheets accounting.settings accounting.attachments accounting.transactions accounting.contacts payroll.settings offline_access"

// Xero Client ID is typically 32 chars (UUID format), Client Secret is 40+ chars
// This validates that credentials look like valid Xero credentials, not other data
const isValidXeroClientId = (value: string | null | undefined): boolean => {
  if (!value) return false
  // Xero Client IDs are typically 32 character UUIDs (with or without dashes)
  const cleanValue = value.replace(/-/g, '')
  return cleanValue.length >= 30 && /^[a-fA-F0-9]+$/.test(cleanValue)
}

const isValidXeroClientSecret = (value: string | null | undefined): boolean => {
  if (!value) return false
  // Xero Client Secrets are typically 40+ characters, alphanumeric
  return value.length >= 30 && /^[a-zA-Z0-9_-]+$/.test(value)
}

export default function XeroPage() {
  const [token, setToken] = useState<Token | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isNewToken, setIsNewToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    client_id: "",
    client_secret: "",
  })
  const [showHelpPopup, setShowHelpPopup] = useState(false)

  useEffect(() => {
    fetchToken()
  }, [])

  // Fetch tenant info if we have an access token but no tenant info
  useEffect(() => {
    const fetchTenantInfo = async () => {
      if (token?.access_token && !token?.tenantid) {
        try {
          const response = await fetch('/api/xero/connections')
          const data = await response.json()

          if (response.ok && data.tenant) {
            setToken(prev => prev ? {
              ...prev,
              tenantid: data.tenant.tenantId,
              tenantname: data.tenant.tenantName,
              tenanttype: data.tenant.tenantType,
            } : prev)
          }
        } catch (error) {
          console.error('Error fetching tenant info:', error)
        }
      }
    }

    fetchTenantInfo()
  }, [token?.access_token, token?.tenantid])

  const createNewToken = () => {
    const newToken: Token = {
      access_token: null,
      client_id: null,
      client_secret: null,
      scope: DEFAULT_SCOPE,
      refresh_token: null,
      dtetme: null,
      tenantid: null,
      tenantname: null,
      tenanttype: null,
      jit: null,
      companyid: 1,
    }
    setToken(newToken)
    setFormData({
      client_id: "",
      client_secret: "",
    })
    setIsNewToken(true)
    setIsEditing(true)
    setError(null)
  }

  const fetchToken = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/token`)

      if (response.ok) {
        const data = await response.json()
        setToken(data)
        // Only use stored credentials if they look like valid Xero credentials
        // Otherwise default to blank (prevents showing email/password from other systems)
        setFormData({
          client_id: isValidXeroClientId(data?.client_id) ? data.client_id : "",
          client_secret: isValidXeroClientSecret(data?.client_secret) ? data.client_secret : "",
        })
        setIsNewToken(false)
      } else {
        createNewToken()
      }
    } catch (err) {
      createNewToken()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!token) return

    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      // Map token fields to API expected format (companyid -> companyId)
      const payload = {
        companyId: token.companyid,
        client_id: formData.client_id.trim() || null,
        client_secret: formData.client_secret.trim() || null,
        scope: token.scope,
      }

      const method = isNewToken ? "POST" : "PUT"
      const response = await fetch("/api/token", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const savedToken = await response.json()
        // Map API response back to frontend format (companyId -> companyid)
        setToken({
          ...token,
          companyid: savedToken.companyId,
          client_id: savedToken.client_id,
          client_secret: savedToken.client_secret,
          access_token: savedToken.access_token || null,
          tenantid: savedToken.tenant_id || null,
          tenantname: savedToken.tenant_name || null,
          tenanttype: savedToken.tenant_type || null,
          scope: savedToken.scope || token.scope,
        })
        setSuccess(isNewToken ? "Token created successfully" : "Token updated successfully")
        setIsEditing(false)
        setIsNewToken(false)
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to save token: ${response.status} - ${errorText}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token")
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleDisconnect = async () => {
    try {
      setIsSaving(true)
      setError(null)

      // Clear the access token and refresh token
      const response = await fetch("/api/token", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: null,
          refresh_token: null,
          tenant_id: null,
          tenant_name: null,
          tenant_type: null,
          expires_at: null,
        }),
      })

      if (response.ok) {
        setToken(prev => prev ? {
          ...prev,
          access_token: null,
          refresh_token: null,
          tenantid: null,
          tenantname: null,
          tenanttype: null,
        } : prev)
        setSuccess("Disconnected from Xero. Click 'Connect to Xero' to reconnect with updated permissions.")
      } else {
        throw new Error("Failed to disconnect")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setIsSaving(false)
    }
  }

  const handleXeroConnect = (clientIdOverride?: string | null) => {
    const clientId = clientIdOverride || formData.client_id || token?.client_id

    if (!clientId) {
      setError("Please enter a Client ID before connecting to Xero")
      return
    }

    // Use current browser URL for redirect (works on any domain)
    const redirectUri = typeof window !== 'undefined'
      ? `${window.location.origin}/api/xero/callback`
      : "http://localhost:3001/api/xero/callback"
    const scopes = token?.scope || DEFAULT_SCOPE
    const state = "1"

    const authUrl = `https://login.xero.com/identity/connect/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}&scope=${encodeURIComponent(scopes)}`

    window.open(authUrl, "_blank", "width=600,height=700,scrollbars=yes,resizable=yes")
    localStorage.setItem('xerotoken', 'true')
  }

  const saveXeroClientSecret = async (clientId: string, clientSecret: string): Promise<string> => {
    if (!token) return "No token available"

    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      // Map token fields to API expected format (companyid -> companyId)
      const payload = {
        companyId: token.companyid,
        client_id: clientId.trim() || null,
        client_secret: clientSecret.trim() || null,
        scope: token.scope,
      }

      const method = isNewToken ? "POST" : "PUT"
      const response = await fetch("/api/token", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const savedToken = await response.json()
        // Map API response back to frontend format (companyId -> companyid)
        setToken({
          ...token,
          companyid: savedToken.companyId,
          client_id: savedToken.client_id,
          client_secret: savedToken.client_secret,
          access_token: savedToken.access_token || null,
          tenantid: savedToken.tenant_id || null,
          tenantname: savedToken.tenant_name || null,
          tenanttype: savedToken.tenant_type || null,
          scope: savedToken.scope || token.scope,
        })
        setFormData({
          client_id: clientId,
          client_secret: clientSecret,
        })
        setIsNewToken(false)
        setSuccess("Credentials saved successfully")
        return "Credentials saved successfully"
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to save: ${response.status} - ${errorText}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save credentials"
      setError(errorMsg)
      return errorMsg
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AdaptiveLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading token information...</span>
          </div>
        </div>
      </AdaptiveLayout>
    )
  }

  return (
    <AdaptiveLayout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Connect to Xero</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Set up your Xero OAuth credentials to enable integration
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowHelpPopup(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Setup Guide</span>
                </button>
                <a
                  href="/dashboard"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Back to Dashboard
                </a>
              </div>
            </div>
          </div>

          <div className="p-6">
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

            {token ? (
              <div className="space-y-6">
                {/* Connection Status */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">Connection Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Tenant Name:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {token.tenantname || "Not connected"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 font-medium ${token.access_token ? "text-green-600" : "text-gray-500"}`}>
                        {token.access_token ? "Connected" : "Not connected"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client Credentials */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Client Credentials</h3>
                    {!isEditing && !isNewToken && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center space-x-1 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Client ID */}
                    <div>
                      <label htmlFor="xero_client_id" className="block text-sm font-medium text-gray-700 mb-1">
                        Client ID *
                      </label>
                      {isEditing || isNewToken ? (
                        <input
                          type="text"
                          id="xero_client_id"
                          name="xero_client_id"
                          autoComplete="off"
                          data-lpignore="true"
                          data-form-type="other"
                          value={formData.client_id || ""}
                          onChange={(e) => handleInputChange("client_id", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your Xero client ID (e.g. 7B1234...)"
                          required
                        />
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                          {isValidXeroClientId(token.client_id) ? token.client_id : "Not set"}
                        </div>
                      )}
                    </div>

                    {/* Client Secret */}
                    <div>
                      <label htmlFor="xero_client_secret" className="block text-sm font-medium text-gray-700 mb-1">
                        Client Secret *
                      </label>
                      {isEditing || isNewToken ? (
                        <div className="relative">
                          <input
                            type="text"
                            id="xero_client_secret"
                            name="xero_client_secret"
                            autoComplete="off"
                            data-lpignore="true"
                            data-form-type="other"
                            value={formData.client_secret || ""}
                            onChange={(e) => handleInputChange("client_secret", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your Xero client secret"
                            required
                          />
                        </div>
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                          {isValidXeroClientSecret(token.client_secret) ? "••••••••••••" : "Not set"}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {(isEditing || isNewToken) && (
                      <div className="flex items-center space-x-3 pt-4">
                        <button
                          onClick={handleSave}
                          disabled={isSaving || !formData.client_id.trim() || !formData.client_secret.trim()}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          <span>{isSaving ? "Saving..." : "Save Credentials"}</span>
                        </button>
                        {!isNewToken && (
                          <button
                            onClick={() => {
                              setIsEditing(false)
                              setFormData({
                                client_id: token?.client_id || "",
                                client_secret: token?.client_secret || "",
                              })
                              setError(null)
                              setSuccess(null)
                            }}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Xero OAuth Section */}
                {(token.client_id || formData.client_id) && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Xero Authorization</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {token.access_token ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-green-800">Connected to Xero</p>
                              <p className="text-sm text-green-600">Your integration is active</p>
                            </div>
                          </div>

                          {/* Token Details */}
                          <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg space-y-2">
                            <h4 className="text-sm font-semibold text-gray-800">Token Details</h4>
                            <div className="text-xs font-mono space-y-1">
                              <div>
                                <span className="text-gray-600">Access Token:</span>
                                <span className="ml-2 text-gray-800">
                                  {token.access_token ? `${token.access_token.substring(0, 20)}...${token.access_token.substring(token.access_token.length - 10)}` : "None"}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Refresh Token:</span>
                                <span className="ml-2 text-gray-800">
                                  {token.refresh_token ? `${token.refresh_token.substring(0, 20)}...${token.refresh_token.substring(token.refresh_token.length - 10)}` : "None"}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Tenant ID:</span>
                                <span className="ml-2 text-gray-800">{token.tenantid || "None"}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Tenant Name:</span>
                                <span className="ml-2 text-gray-800">{token.tenantname || "None"}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Expires:</span>
                                <span className="ml-2 text-gray-800">{token.expires_at ? new Date(token.expires_at).toLocaleString() : (token.dtetme ? new Date(token.dtetme).toLocaleString() : "Unknown")}</span>
                              </div>
                            </div>
                          </div>

                          {/* Export Uncoded Statement Lines */}
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-800 mb-2">Export Unreconciled Transactions</h4>
                            <p className="text-sm text-blue-700 mb-3">
                              Export your bank feed statement lines from Xero to CSV for processing:
                            </p>
                            <a
                              href="https://go.xero.com/Banking/StatementLines/Offline/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                              <span>Export Uncoded Statement Lines</span>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <p className="text-xs text-blue-600 mt-2">
                              Select your bank account, date range, then click &quot;Export&quot; → CSV
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleXeroConnect()}
                              className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors shadow-sm"
                            >
                              <CheckCircle className="h-5 w-5" />
                              <span>Reconnect to Xero</span>
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleDisconnect}
                              className="inline-flex items-center space-x-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors shadow-sm"
                            >
                              <span>Disconnect</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">Not Connected</p>
                              <p className="text-sm text-amber-600">Click below to authorize with Xero</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleXeroConnect()}
                            disabled={!formData.client_id.trim() && !token.client_id}
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                          >
                            <span>Connect to Xero</span>
                            <ExternalLink className="h-4 w-4" />
                          </button>

                          {/* Troubleshooting Section */}
                          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Connection Failed?</h4>
                            <p className="text-sm text-gray-600 mb-3">
                              If your connection failed, you may need to disconnect the app from Xero first, then try connecting again.
                            </p>
                            <a
                              href="https://go.xero.com/Settings/ConnectedApps"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              <span>Disconnect from Xero Connected Apps</span>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <p className="text-xs text-gray-500 mt-2">
                              Find this app in the list and click &quot;Disconnect&quot;, then return here and click &quot;Connect to Xero&quot; again.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Help Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-blue-900">Need help setting up your Xero credentials?</p>
                    </div>
                    <button
                      onClick={() => setShowHelpPopup(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      <span>View Setup Guide</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No integration configured</p>
                <button
                  onClick={createNewToken}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <span>Set up Xero Integration</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Xero Help Popup */}
      <XeroHelpPopup
        handleXeroConnect={handleXeroConnect}
        clientid={formData.client_id}
        secret={formData.client_secret}
        isOpen={showHelpPopup}
        onClose={() => setShowHelpPopup(false)}
        SaveXeroClientSecret={saveXeroClientSecret}
      />
    </AdaptiveLayout>
  )
}
