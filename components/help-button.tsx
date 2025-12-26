"use client"

import { HelpCircle } from "lucide-react"

interface CompactHelpButtonProps {
  onClick: () => void
}

export function CompactHelpButton({ onClick }: CompactHelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-110 z-50"
      aria-label="Help"
    >
      <HelpCircle className="h-6 w-6" />
    </button>
  )
}
