"use client"

import { LayoutDashboard, Calendar, Layers, Users, Settings } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createClient } from '@/lib/supabase/client'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

export type Company = {
  id: string
  company_name: string
}

type Props = {
  companies: Company[]
  primaryCompany: Company
}

export function WorkspaceSidebar({ companies, primaryCompany }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(primaryCompany.id)
  
  const selectedCompany =
    companies.find((c) => c.id === selectedCompanyId) ?? primaryCompany


    const [loading, setLoading] = useState(false)
      const router = useRouter()
      const supabase = createClient()
      const pathname = usePathname() 
    
      const handleSignOut = async () => {
        setLoading(true)
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
      }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-slate-50/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF6B35] via-[#C44569] to-[#6C5CE7] text-white text-lg font-bold shadow-md">
          A
        </div>
        <div className="flex flex-col">
          <Link href={"/"}>
            <span className="text-sm font-semibold text-slate-900">{selectedCompany.company_name}</span>
          </Link>  
        </div>
      </div>

      <nav className="px-3 space-y-1">
        <SidebarItem 
          icon={LayoutDashboard} 
          label="Workspaces" 
          href="/workspaces" 
          active={pathname === "/workspaces"} 
        />
        <SidebarItem 
          icon={Users} 
          label="Building Buddy" 
          href="/workspaces/building-buddy" 
          active={pathname === "/workspaces/building-buddy"} 
        />
        <SidebarItem 
          icon={Calendar} 
          label="Calendar" 
          href="/workspaces/calendar"
          active={pathname === "/workspaces/calendar"} 
        />
        <SidebarItem 
          icon={Layers} 
          label="Issues" 
          href="/workspaces/issues"
          active={pathname === "/workspaces/issues"} 
        />
      </nav>

      <div className="mt-8 px-5">
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Teams</p>
        <div className="space-y-1 text-sm">
          {["Design", "UI/UX", "Development", "Marketing", "Sales"].map((team) => (
            <button
              key={team}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <span>{team}</span>
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto px-5 py-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
        <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white">
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
        <button 
        onClick={handleSignOut}
        disabled={loading}
        className="text-slate-400 hover:text-slate-600">
            {loading ? 'Signing out...' : 'Log out'}
        </button>
      </div>
    </aside>
  )
}

type SidebarItemProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  active?: boolean
}

function SidebarItem({ icon: Icon, label, href, active }: SidebarItemProps) {
  const className = cn(
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
    active
      ? "bg-white text-slate-900 shadow-sm border border-[#FF6B35]/30"
      : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button className={className}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}