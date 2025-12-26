import Image from "next/image"
import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center px-8 py-16">
        <div className="text-center space-y-8">
          {/* Logo/Title */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              AI Tax Assistant
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Automate your quarterly activity statement with AI-powered Xero integration
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="text-blue-600 text-3xl mb-3">🔗</div>
              <h3 className="font-semibold text-gray-900 mb-2">Connect to Xero</h3>
              <p className="text-sm text-gray-600">Seamlessly integrate with your Xero accounting file</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="text-blue-600 text-3xl mb-3">🤖</div>
              <h3 className="font-semibold text-gray-900 mb-2">AI-Powered</h3>
              <p className="text-sm text-gray-600">Automatically code transactions and reconcile statements</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="text-blue-600 text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-gray-900 mb-2">BAS Ready</h3>
              <p className="text-sm text-gray-600">Generate reports for your activity statement</p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 duration-200"
            >
              Get Started
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <p className="text-sm text-gray-500">
              No credit card required. Start automating your tax preparation today.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
