"use client"

import { X, ExternalLink, Copy, CheckCircle, Eye, EyeOff, AlertCircle } from "lucide-react"
import { useState } from "react"
import ModalWrapper from "@/components/modal-wrapper"

interface XeroHelpPopupProps {
  handleXeroConnect:(clientid: string|null)=>void
  clientid: string
  secret: string
  isOpen: boolean
  onClose: () => void
  SaveXeroClientSecret: (clientid: string, secret: string) => Promise<string>
}

export default function XeroHelpPopup({handleXeroConnect, clientid, secret, isOpen, onClose, SaveXeroClientSecret }: XeroHelpPopupProps) {
  const [copiedStep, setCopiedStep] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string>(clientid)
  const [clientSecret, setClientSecret] = useState<string>(secret)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const redirectUri = process.env.NEXT_PUBLIC_XERO_REDIR || "http://localhost:3001/api/xero/callback"
  const appUrl = redirectUri.replace('/api/xero/callback', '')

  const getMaskedSecret = (secret: string) => {
    if (!secret || secret.length < 4) return secret
    if (showSecret) return secret

    const first2 = secret.substring(0, 2)
    const last2 = secret.substring(secret.length - 2)
    const middleLength = secret.length - 4
    const masked = first2 + '•'.repeat(middleLength) + last2
    return masked
  }

  const copyToClipboard = async (text: string, stepId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStep(stepId)
      setTimeout(() => setCopiedStep(null), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 rounded-t-lg flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Integrate to your Company Xero Account</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close help guide"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-2 sm:p-6 overflow-y-auto flex-1">
          <div className="space-y-4 sm:space-y-8">
            {/* Step 1 */}
            <div className="border border-gray-200 rounded-lg p-2 sm:p-6 bg-gray-50">
              <div className="flex items-center gap-1 sm:gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Go to Xero Developer API and Sign In</h3>
              </div>
              <div className="space-y-3 ml-1 sm:ml-11">
                <p className="text-gray-700">
                  Navigate to the Xero Developer portal and sign in with your Xero account credentials.
                </p>
                <div className="bg-white p-2 sm:p-4 rounded-md border">
                  <p className="font-medium text-gray-900 mb-2">Go to Xero Developer Portal:</p>
                  <div className="flex items-center gap-1">
                    <code className="bg-gray-100 px-1 sm:px-2 py-1 rounded text-sm flex-1">
                    <a
                      href="https://developer.xero.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex p-2 hover:bg-gray-100 rounded transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4 text-blue-600" /><u>https://developer.xero.com/</u>
                      </a></code>
                    <button
                      onClick={() => copyToClipboard("https://developer.xero.com/", "step1-url")}
                      className="p-2 hover:bg-gray-100 rounded transition-colors"
                      title="Copy URL"
                    >
                      {copiedStep === "step1-url" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-1 sm:ml-4">
                  <li>Click &quot;Sign in&quot; in the top right corner</li>
                  <li>Use your existing Xero account credentials</li>
                  <li>If you don&apos;t have a Xero account, you&apos;ll need to create one first</li>
                </ul>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border border-gray-200 rounded-lg p-2 sm:p-6 bg-gray-50">
              <div className="flex items-center gap-1 sm:gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Click Add New App and Enter Details</h3>
              </div>
              <div className="space-y-3 ml-1 sm:ml-11">
                <p className="text-gray-700">
                  Create a new app with the following configuration as shown in the screenshot below:
                </p>

                {/* Screenshot */}
                <div className="bg-white p-2 sm:p-4 rounded-md border">
                  <p className="font-medium text-gray-900 mb-3">Fill in the form as shown:</p>
                  <div className="w-full max-w-md mx-auto border border-gray-200 rounded-lg shadow-sm bg-gray-50 p-2 sm:p-6 space-y-6">
                    {/* App name section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">App name</label>
                      <div className="relative">
                        <input
                          type="text"
                          value="aitax"
                          readOnly
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-white text-gray-900"
                        />
                        <button
                          onClick={() => copyToClipboard("aitax", "step2-appname")}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Copy app name"
                        >
                          {copiedStep === "step2-appname" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Integration type section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Integration type</label>
                      <div className="space-y-3">
                        <div className="border border-gray-300 rounded-md p-2 sm:p-4 bg-white">
                          <div className="flex items-start">
                            <input
                              type="radio"
                              checked
                              readOnly
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div className="ml-1 sm:ml-3">
                              <label className="block text-sm font-medium text-gray-900">Web app</label>
                              <p className="text-sm text-gray-600 mt-1">Standard auth code</p>
                              <p className="text-sm text-gray-500 mt-2">Connect up to 25 organisations before certification</p>
                            </div>
                          </div>
                        </div>

                        <div className="border border-gray-300 rounded-md p-2 sm:p-4 bg-white opacity-60">
                          <div className="flex items-start">
                            <input
                              type="radio"
                              disabled
                              className="mt-1 h-4 w-4 text-gray-300 border-gray-300"
                            />
                            <div className="ml-1 sm:ml-3">
                              <label className="block text-sm font-medium text-gray-900">Mobile or desktop app</label>
                              <p className="text-sm text-gray-600 mt-1">Auth code with PKCE. For native apps that can&apos;t securely store a client secret</p>
                              <p className="text-sm text-gray-500 mt-2">Connect up to 25 organisations before certification</p>
                            </div>
                          </div>
                        </div>

                        <div className="border border-gray-300 rounded-md p-2 sm:p-4 bg-white opacity-60">
                          <div className="flex items-start">
                            <input
                              type="radio"
                              disabled
                              className="mt-1 h-4 w-4 text-gray-300 border-gray-300"
                            />
                            <div className="ml-1 sm:ml-3">
                              <label className="block text-sm font-medium text-gray-900">Custom connection</label>
                              <p className="text-sm text-gray-600 mt-1">Premium one-to-one integration that utilises the client credentials grant type</p>
                              <p className="text-sm text-gray-500 mt-2">Only available to Xero organisations in UK, Australia, New Zealand and USA</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <a href="#" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                        Learn more about integration types <span className="text-xs">↗</span>
                      </a>
                    </div>

                    {/* Company URL section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company or application URL</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={appUrl}
                          readOnly
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-white text-gray-900"
                        />
                        <button
                          onClick={() => copyToClipboard(appUrl, "step2-url")}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Copy company URL"
                        >
                          {copiedStep === "step2-url" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Redirect URI section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Redirect URI</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={redirectUri}
                          readOnly
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-white text-gray-900"
                        />
                        <button
                          onClick={() => copyToClipboard(redirectUri, "step2-redirect")}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Copy redirect URI"
                        >
                          {copiedStep === "step2-redirect" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Add more redirects after creating app. <a href="#" className="text-blue-600 hover:underline">Learn about redirects <span className="text-xs">↗</span></a>
                      </p>
                    </div>

                    {/* Terms checkbox */}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        I have read and agree to the <a href="#" className="text-blue-600 hover:underline">Xero Developer Platform Terms & Conditions</a>
                      </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 sm:gap-3 pt-4">
                      <button className="px-2 sm:px-6 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        Create app
                      </button>
                      <button className="px-2 sm:px-6 py-2.5 bg-white text-gray-700 font-medium rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-1 sm:ml-4">
                  <li>Check the &quot;I have read and agree to the Xero Developer Platform Terms & Conditions&quot; checkbox</li>
                  <li>Click &quot;Create app&quot; to proceed</li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="border border-gray-200 rounded-lg p-2 sm:p-6 bg-gray-50">
              <div className="flex items-center gap-1 sm:gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Get Client ID and Generate Client Secret</h3>
              </div>
              <div className="space-y-3 ml-1 sm:ml-11">
                <p className="text-gray-700">
                  After creating your app, go to the Configuration tab to get your credentials.
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-1 sm:ml-4">
                  <li>Click on the &quot;Configuration&quot; tab in your newly created app and it should appear as below</li>

                  {/* Xero Configuration Screen */}
                  <div className="bg-white p-2 sm:p-4 rounded-md border my-4">
                    <div className="w-full max-w-2xl mx-auto space-y-6">
                      {/* Connection section */}
                      <div className="text-center">
                        <h2 className="text-2xl font-semibold mb-2">Connection</h2>
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <span className="text-lg">0 of 25 connections</span>
                          <div className="inline-flex items-center justify-center w-5 h-5 bg-gray-600 text-white rounded-full text-xs">
                            i
                          </div>
                        </div>
                      </div>

                      {/* Redirect URIs section */}
                      <div>
                        <h3 className="text-lg font-medium mb-3">Redirect URIs</h3>
                        <div className="border border-gray-300 rounded-md p-3 mb-2">
                          <span className="text-gray-800">{redirectUri}</span>
                        </div>
                        <span className="text-blue-600 text-sm cursor-default">
                          Learn about redirects <span className="text-xs">↗</span>
                        </span>
                        <div className="mt-4">
                          <span className="text-blue-600 font-medium cursor-default">
                            Add another URI
                          </span>
                        </div>
                      </div>

                      {/* Client ID section */}
                      <div>
                        <h3 className="text-lg font-medium mb-3">Client id</h3>
                        <div className="bg-gray-100 rounded-md p-2 sm:p-4 flex items-center justify-between">
                          <span className="font-mono text-gray-900">7B••••••••••••••••••••••••0C</span>
                          <div className="flex items-center gap-1 sm:gap-3">
                            <span className="p-2 rounded cursor-default">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </span>
                            <span className="text-blue-600 font-medium cursor-default">
                              Copy
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Generate secret button */}
                      <div className="text-center pt-4">
                        <span className="text-blue-600 text-lg font-medium cursor-default">
                          Generate a secret
                        </span>
                      </div>
                    </div>
                  </div>

                  <li>
                    In your Xero page click Copy next to the <strong>Client ID</strong> (this will be visible immediately)
                  </li>
                  <li className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Copy your Client ID here:</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Enter your Client ID"
                      className="bg-white text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </li>
                  <li>
                    Click &quot;Generate a secret&quot; to create a <strong>Client Secret</strong>
                  </li>
                  <li>Copy the Client Secret immediately (you won&apos;t be able to see it again)</li>
                  <li className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Copy your Client Secret here:</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={clientSecret ? getMaskedSecret(clientSecret) : ''}
                        onChange={(e) => {
                          setClientSecret(e.target.value)
                        }}
                        placeholder="Enter your Client Secret"
                        className="bg-white text-black w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                        title={showSecret ? "Hide secret" : "Show secret"}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </li>
                  <li>Paste both the Client ID and Client Secret into the form fields in this application</li>
                  <li>
                    <button
                      onClick={async () => {
                        if (clientId && clientSecret) {
                          setIsSaving(true)
                          try {
                            const message = await SaveXeroClientSecret(clientId, clientSecret)
                            setSaveMessage(message)
                          } catch (error) {
                            setSaveMessage('Error saving credentials')
                          } finally {
                            setIsSaving(false)
                          }
                        }
                      }}
                      disabled={!clientId || !clientSecret || isSaving}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    {saveMessage && (
                      <div className={`mt-2 p-2 rounded-md text-sm ${
                        saveMessage.toLowerCase().includes('success')
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {saveMessage}
                      </div>
                    )}
                  </li>
                </ul>
                <div className="bg-red-50 border border-red-200 rounded-md p-2 sm:p-3">
                  <p className="text-red-800 text-sm">
                    <strong>Important:</strong> Copy your Client Secret immediately after generating it. You won&apos;t be
                    able to view it again for security reasons.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="border border-gray-200 rounded-lg p-2 sm:p-6 bg-green-50 border-green-200">
              <div className="flex items-center gap-1 sm:gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full font-bold">
                  4
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Click Connect to Xero and Follow the Prompts</h3>
              </div>
              <div className="space-y-3 ml-1 sm:ml-11">
                <p className="text-gray-700">Complete the integration by connecting to your Xero account.</p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-1 sm:ml-4">
                  <li>Click the &quot;Connect to Xero&quot; button in this application</li>
                  <li>
                  <button
                         onClick={()=>handleXeroConnect(clientId.trim())}
                          disabled={clientId==null || clientId=='' || clientSecret==null || clientSecret==''}
                          className="inline-flex items-center space-x-1 px-1 sm:px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          <AlertCircle className="h-5 w-5" />
                          <span>Connect to Xero</span>
                          <ExternalLink className="h-4 w-4" />
                        </button>
                  </li>
                  <li>A popup window will open with the Xero authorization page</li>
                  <li>Sign in to your Xero account if prompted</li>
                  <li>Select the organization you want to connect to</li>
                  <li>Review and approve the permissions requested</li>
                  <li>Click &quot;Allow access&quot; to complete the connection</li>
                  <li>The popup will close and you&apos;ll see a success message</li>
                </ul>
                <div className="bg-green-100 border border-green-300 rounded-md p-2 sm:p-3">
                  <p className="text-green-800 text-sm">
                    <strong>Success!</strong> Once completed, the &quot;Connect to Xero&quot; button will turn green and show
                    &quot;Connected to Xero&quot;.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-2 sm:p-4 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-2 sm:px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  )
}
