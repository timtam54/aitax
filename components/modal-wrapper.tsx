"use client"

import { useEffect, ReactNode } from "react"
import { createPortal } from "react-dom"

interface ModalWrapperProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
  fullscreen?: boolean
  borderColor?: string
}

/**
 * Universal modal wrapper that fixes z-index and positioning issues on iOS
 * Uses React Portal to render at document.body level
 */
export default function ModalWrapper({ isOpen, onClose, children, maxWidth = "max-w-2xl", fullscreen = false, borderColor = "border-white" }: ModalWrapperProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.scrollTo(0, 0)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 z-[99999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Modal Content */}
      <div
        className={`absolute inset-0 flex items-center justify-center ${fullscreen ? 'p-0' : 'p-4'}`}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div
          className={`bg-white ${fullscreen ? '' : 'rounded-lg'} shadow-xl ${maxWidth} w-full ${fullscreen ? 'h-full' : 'max-h-[90vh]'} overflow-hidden relative ${fullscreen ? '' : `border-4 ${borderColor}`}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null
}
