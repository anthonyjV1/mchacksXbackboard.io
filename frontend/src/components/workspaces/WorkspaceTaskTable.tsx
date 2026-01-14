"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Trash2, Search } from "lucide-react"

interface Task {
  id: string
  title: string
  team: string
  classification: string
  priority: "High" | "Medium" | "Low"
  status: string
  deadline: string | null
  created_at: string
  updated_at: string
}

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  companyId: string
  classification: string
  refreshTrigger: number
  sortBy: string
}

export function WorkspaceTaskTable({ selectedId, onSelect, companyId, classification, refreshTrigger, sortBy }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        let query = supabase
          .from("workspaces")
          .select("id, title, team, classification, priority, status, deadline, created_at, updated_at")
          .eq("company_id", companyId)
          .eq("classification", classification)

        // Apply sorting based on sortBy
        if (sortBy === 'priority') {
          query = query.order('priority', { ascending: true })
        } else if (sortBy === 'recent') {
          query = query.order('updated_at', { ascending: false })
        } else {
          query = query.order('created_at', { ascending: false })
        }

        const { data, error } = await query

        if (error) throw error
        
        // Additional sorting for priority (since SQL doesn't know High > Medium > Low)
        if (sortBy === 'priority' && data) {
          const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 }
          data.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder])
        }
        
        setTasks(data || [])
      } catch (error) {
        console.error("Error fetching tasks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [companyId, classification, refreshTrigger, sortBy])

  const handleDelete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm("Are you sure you want to delete this workflow?")) return

    setDeletingId(taskId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("workspaces")
        .delete()
        .eq("id", taskId)

      if (error) throw error

      setTasks(tasks.filter(t => t.id !== taskId))
      
      if (selectedId === taskId) {
        onSelect("")
      }
    } catch (error) {
      console.error("Error deleting task:", error)
      alert("Failed to delete workflow")
    } finally {
      setDeletingId(null)
    }
  }

  // Filter tasks based on search query
  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.status.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <section className="flex-1 overflow-hidden bg-slate-50">
      <div className="flex h-full flex-col px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Workflows</h2>
            <span className="text-xs text-slate-400 font-medium">{tasks.length} total</span>
          </div>
          
          {/* Aesthetic Search Bar */}
          <div className="relative w-64">
            <div className="relative flex items-center bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-300 transition-all">
              <Search className="w-4 h-4 text-slate-400 ml-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-1.5 text-sm bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Table with Subtle Animated Border */}
        <div className="relative animate-fade-in">
          {/* Subtle Animated Glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF6B35]/20 via-[#4ECDC4]/20 to-[#6C5CE7]/20 rounded-2xl blur-md animate-pulse-slow"></div>
          <div className="absolute -inset-px bg-gradient-to-r from-[#FF6B35]/40 via-[#4ECDC4]/40 to-[#6C5CE7]/40 rounded-2xl"></div>
          
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_60px] border-b border-slate-200 bg-gradient-to-r from-slate-50/50 to-white px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <span>Workflow</span>
              <span>Team</span>
              <span>Status</span>
              <span>Deadline</span>
              <span className="text-right">Priority</span>
              <span></span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[530px] overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-[#FFE66D] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-[#4ECDC4] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <span className="ml-2">Loading workflows...</span>
                  </div>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <p className="text-sm font-medium">{searchQuery ? 'No workflows found' : 'No workflows yet'}</p>
                  <p className="text-xs mt-1">{searchQuery ? 'Try a different search term' : 'Click "Create Workflow" to add one'}</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <Row
                    key={task.id}
                    task={task}
                    active={task.id === selectedId}
                    onClick={() => onSelect(task.id)}
                    onDelete={(e) => handleDelete(task.id, e)}
                    isDeleting={deletingId === task.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

interface RowProps {
  task: Task
  active: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isDeleting: boolean
}

function Row({ task, active, onClick, onDelete, isDeleting }: RowProps) {
  const [isHovered, setIsHovered] = useState(false)

  const priorityColors: Record<Task["priority"], string> = {
    High: "bg-[#FF6B35]/10 text-[#FF6B35] border-[#FF6B35]/30",
    Medium: "bg-[#FFE66D]/20 text-amber-700 border-amber-300",
    Low: "bg-[#4ECDC4]/10 text-emerald-700 border-[#4ECDC4]/30",
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return <span className="text-slate-400 text-xs italic">No deadline</span>
    const date = new Date(deadline)
    const today = new Date()
    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return <span className="text-red-600 text-xs font-semibold">Overdue</span>
    } else if (diffDays === 0) {
      return <span className="text-[#FF6B35] text-xs font-semibold">Today</span>
    } else if (diffDays <= 3) {
      return <span className="text-amber-600 text-xs font-semibold">{diffDays}d left</span>
    } else {
      return <span className="text-slate-600 text-xs">{date.toLocaleDateString()}</span>
    }
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={
        "grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_60px] items-center px-5 py-3 text-sm transition-all duration-200 cursor-pointer " +
        (active
          ? "bg-gradient-to-r from-[#FF6B35]/5 via-[#FFE66D]/8 to-[#4ECDC4]/5 border-l-2 border-l-[#7365e4]"
          : "hover:bg-slate-50/50")
      }
    >
      <span className="text-left text-slate-900 font-medium truncate">{task.title}</span>
      <span className="text-slate-700 font-medium">{task.team}</span>
      <span className="text-slate-600 text-xs">{task.status}</span>
      <span className="text-slate-600">{formatDeadline(task.deadline)}</span>
      <span className="flex justify-end">
        <span className={`rounded-full border-2 px-3 py-1 text-xs font-bold shadow-sm ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </span>
      <span className="flex justify-end">
        {isHovered && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 shadow-sm"
            title="Delete workflow"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </span>
    </div>
  )
}
