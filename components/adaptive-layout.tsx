"use client"

import React from "react"

interface AdaptiveLayoutProps {
  children: React.ReactNode
}

export default function AdaptiveLayout({ children }: AdaptiveLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  )
}
