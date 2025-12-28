"use client"

import { useState, useEffect } from "react"
import AdaptiveLayout from "@/components/adaptive-layout"
import {
  CheckCircle,
  Circle,
  Database,
  Code,
  Users,
  FileText,
  ExternalLink,
  AlertCircle,
  Clock,
  ArrowRight,
  Upload
} from "lucide-react"

interface Task {
  id: number
  title: string
  description: string
  status: "completed" | "in-progress" | "pending"
  icon: React.ReactNode
  action?: () => void
  actionLabel?: string
  externalLink?: string
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: "Connect to Xero",
      description: "Set up OAuth connection with your Xero accounting file to enable data synchronization",
      status: "pending",
      icon: <Database className="h-6 w-6" />,
      actionLabel: "Configure Connection",
      externalLink: "/xero"
    },
    {
      id: 2,
      title: "Reconcile Bank Statements",
      description: "Automatically match and reconcile all bank transactions in Xero using AI",
      status: "pending",
      icon: <CheckCircle className="h-6 w-6" />,
      actionLabel: "Start Reconciliation",
      externalLink: "/reconcile"
    },
    {
      id: 3,
      title: "Import & Code Transactions",
      description: "Upload Xero Statement Lines CSV, use AI to suggest account codes, and push coded transactions to Xero",
      status: "pending",
      icon: <Upload className="h-6 w-6" />,
      actionLabel: "Import Transactions",
      externalLink: "/import"
    },
    {
      id: 4,
      title: "Verify Staff Payruns",
      description: "Check all staff payments have associated payruns and complete any outstanding payroll processing",
      status: "pending",
      icon: <Users className="h-6 w-6" />,
      actionLabel: "Review Payruns"
    },
    {
      id: 5,
      title: "Generate Activity Statement Reports",
      description: "Run reports in Xero to extract all necessary data for your quarterly Business Activity Statement (BAS)",
      status: "pending",
      icon: <FileText className="h-6 w-6" />,
      actionLabel: "Run Reports"
    },
    {
      id: 6,
      title: "Complete ATO Activity Statement",
      description: "Instructions for connecting to myGov Business portal and lodging your BAS with the Australian Taxation Office",
      status: "pending",
      icon: <ExternalLink className="h-6 w-6" />,
      actionLabel: "View Guide"
    }
  ])

  // Check Xero connection status from API
  useEffect(() => {
    const checkXeroConnection = async () => {
      try {
        const response = await fetch('/api/xero/connections')
        const data = await response.json()

        // Check if we got a successful response with tenant info
        if (response.ok && (data.success || data.tenant)) {
          setTasks(prev => prev.map(task =>
            task.id === 1 ? { ...task, status: "completed" as const } : task
          ))
        }
      } catch (error) {
        console.error('Error checking Xero connection:', error)
      }
    }

    checkXeroConnection()
  }, [])

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50 border-green-200"
      case "in-progress":
        return "text-blue-600 bg-blue-50 border-blue-200"
      case "pending":
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "in-progress":
        return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
      case "pending":
        return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusLabel = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return "Completed"
      case "in-progress":
        return "In Progress"
      case "pending":
        return "Pending"
    }
  }

  const handleTaskAction = (task: Task) => {
    if (task.externalLink) {
      window.location.href = task.externalLink
    } else if (task.action) {
      task.action()
    } else {
      // Show guide for task 6
      if (task.id === 6) {
        showMyGovGuide()
      }
    }
  }

  const showMyGovGuide = () => {
    alert(`myGov Business Integration Guide:

1. Go to myGov Business Portal
   Visit: https://www.mygovid.gov.au/

2. Sign in with myGovID
   - Use your myGovID app to authenticate
   - Select your business from the list

3. Navigate to Tax Section
   - Click on "Australian Taxation Office"
   - Select "Activity Statements"

4. Lodge Your BAS
   - Click "Lodge" on your current activity statement
   - Enter the values from your Xero reports:
     * G1: Total Sales
     * G2, G3: Export Sales
     * G10, G11: Capital Purchases
     * 1A: GST on Sales
     * 1B: GST on Purchases
     * And other relevant fields

5. Review and Submit
   - Double-check all figures match your Xero reports
   - Submit your activity statement
   - Download the receipt for your records

Note: Ensure you have run the Activity Statement reports in Xero (Task 5) before proceeding.`)
  }

  return (
    <AdaptiveLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Tax Assistant Dashboard
          </h1>
          <p className="text-gray-600">
            Automate your quarterly activity statement preparation with AI-powered accounting
          </p>
        </div>

        {/* Progress Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Overall Progress</h2>
              <p className="text-sm text-gray-600">
                {tasks.filter(t => t.status === "completed").length} of {tasks.length} tasks completed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{
                    width: `${(tasks.filter(t => t.status === "completed").length / tasks.length) * 100}%`
                  }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className={`bg-white rounded-lg shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                task.status === "completed" ? "border-green-200" : "border-gray-200"
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Task Info */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* Step Number & Icon */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`rounded-full p-3 ${getStatusColor(task.status)} border-2`}>
                        {task.icon}
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        Step {index + 1}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(task.status)}
                          <span className="text-sm font-medium text-gray-600">
                            {getStatusLabel(task.status)}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {task.description}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleTaskAction(task)}
                      disabled={task.id > 1 && task.id !== 3 && tasks[task.id - 2].status !== "completed"}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        task.id > 1 && task.id !== 3 && tasks[task.id - 2].status !== "completed"
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : task.status === "completed"
                          ? "bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300"
                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
                      }`}
                    >
                      {task.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Locked Message */}
                {task.id > 1 && task.id !== 3 && tasks[task.id - 2].status !== "completed" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Complete Step {task.id - 1} before starting this task
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Need Help?</h3>
              <p className="text-sm text-blue-800">
                Tasks must be completed in order. Start by connecting to Xero, then proceed through each step.
                The AI will assist with reconciliation and transaction coding to save you time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  )
}
