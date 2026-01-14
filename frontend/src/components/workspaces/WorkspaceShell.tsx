"use client"

import { useState } from "react"
import { WorkspaceHeader } from "./WorksapceHeader"
import { WorkspaceTabs } from "./WorkspaceTabs"
import { WorkspaceTaskTable } from "./WorkspaceTaskTable"
import { WorkspaceTaskDetails } from "./WorkspaceTaskDetails"

export type Company = {
  id: string
  company_name: string
}

type Props = {
  companies: Company[]
  primaryCompany: Company
  userId: string
}

export function WorkspaceShell({ companies, primaryCompany, userId }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(primaryCompany.id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("Roadmap")
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sortBy, setSortBy] = useState("default")
  
  const selectedCompany =
    companies.find((c) => c.id === selectedCompanyId) ?? primaryCompany

  const handleTaskCreated = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSelectedTaskId(null) // Clear selection when switching tabs
  }

  return (
    <>
      <WorkspaceHeader company={selectedCompany} />
      <WorkspaceTabs
        companyId={selectedCompany.id}
        userId={userId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onTaskCreated={handleTaskCreated}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
      <div className="flex min-h-0 flex-1">
        <WorkspaceTaskTable
          selectedId={selectedTaskId}
          onSelect={setSelectedTaskId}
          companyId={selectedCompany.id}
          classification={activeTab}
          refreshTrigger={refreshTrigger}
          sortBy={sortBy}
        />
        <WorkspaceTaskDetails 
        selectedId={selectedTaskId}
        onTaskUpdated={() => setRefreshTrigger(prev => prev + 1)} 
         />
      </div>
    </>
  )
}