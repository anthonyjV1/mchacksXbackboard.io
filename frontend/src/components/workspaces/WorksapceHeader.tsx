// components/workspaces/DashboardHeader.tsx
"use client"

import { CalendarDays } from "lucide-react"
import type { Company } from "./WorkspaceShell"
import { Button } from "../ui/button"

export function WorkspaceHeader({ company }: { company: Company }) {
  const currentDate = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-8 py-4">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              {company.company_name}
            </h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
              Active
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            <span> {currentDate} </span>
          </div>
        </div>
      </div>
        <Button 
            size="sm" 
            variant="outline" 
            className="h-11 rounded-2xl px-3 text-md font-semibold border-2 border-slate-300 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-[#FF6B35]/5 transition-all duration-200"
            >
            &rarr; Invite Cofounders
        </Button>
    </header>
  )
}
