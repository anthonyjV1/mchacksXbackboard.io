"use client"

import { useState } from "react"
import { CreateTaskModal } from "./CreateTaskModal"

const tabs = ["Roadmap", "Product", "Design", "Growth", "Onboarding", "Operations"]

interface WorkspaceTabsProps {
  companyId: string
  userId: string
  activeTab: string
  onTabChange: (tab: string) => void
  onTaskCreated: () => void
  sortBy: string
  onSortChange: (sort: string) => void
}

export function WorkspaceTabs({ 
  companyId, 
  userId, 
  activeTab, 
  onTabChange, 
  onTaskCreated,
  sortBy,
  onSortChange 
}: WorkspaceTabsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={
                "relative px-4 py-3 text-sm font-medium transition-colors " +
                (tab === activeTab
                  ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gradient-to-r after:from-[#FF6B35] after:via-[#C44569] after:to-[#6C5CE7]"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 py-2">
        <div className="px-4 py-1.5 text-xs font-medium transition-colors">
          <span className="text-xs text-slate-500 px-2">Sort by:</span>
          <button 
            onClick={() => onSortChange('priority')}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === 'priority' 
                ? 'border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-[#FF6B35]/40 hover:text-[#FF6B35]'
            }`}
          >
            Priority
          </button>
          <button 
            onClick={() => onSortChange('recent')}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === 'recent' 
                ? 'border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-[#FF6B35]/40 hover:text-[#FF6B35]'
            }`}
          >
            Recent
          </button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="ml-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#C44569] px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg transition-all"
          >
            Create Workflow
          </button>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        companyId={companyId}
        userId={userId}
        classification={activeTab}
        onTaskCreated={onTaskCreated}
      />
    </>
  )
}