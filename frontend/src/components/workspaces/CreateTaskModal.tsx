"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  userId: string
  classification: string
  onTaskCreated: () => void
}

export function CreateTaskModal({
  isOpen,
  onClose,
  companyId,
  userId,
  classification,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [quickCreateLoading, setQuickCreateLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    team: "",
    status: "To Do",
    priority: "Medium",
    lead: "",
    assignee: "",
    deadline: "",
    description: "",
  })

  const resetForm = () => {
    setFormData({
      title: "",
      team: "",
      status: "To Do",
      priority: "Medium",
      lead: "",
      assignee: "",
      deadline: "",
      description: "",
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }
  

  const handleQuickCreate = async () => {
    setQuickCreateLoading(true)

    try {
      const supabase = createClient()
      
      // Get the next workflow number
      const { data: existingTasks, error: fetchError } = await supabase
        .from("workspaces")
        .select("title")
        .eq("company_id", companyId)
        .eq("classification", classification)
        .like("title", `${classification} Workflow #%`)

      if (fetchError) {
        console.error("Error fetching tasks:", fetchError)
        throw fetchError
      }

      // Find the highest workflow number
      let maxNumber = 0
      if (existingTasks && existingTasks.length > 0) {
        existingTasks.forEach((task) => {
          const match = task.title.match(/#(\d+)$/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (num > maxNumber) maxNumber = num
          }
        })
      }

      const nextNumber = maxNumber + 1
      const quickTitle = `${classification} Workflow #${nextNumber}`

      const { error: insertError } = await supabase.from("workspaces").insert({
        user_id: userId,
        company_id: companyId,
        classification: classification,
        title: quickTitle,
        team: "All",
        status: "To Do",
        priority: "Medium",
        lead: "Not Set",
        assignee: "Not Set",
        deadline: null,
        description: null,
      })

      if (insertError) {
        console.error("Supabase error:", insertError)
        throw insertError
      }

      resetForm()
      onTaskCreated()
      onClose()
    } catch (error) {
      console.error("Error creating quick task:", error)
      alert("Failed to create task. Please try again.")
    } finally {
      setQuickCreateLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.from("workspaces").insert({
        user_id: userId,
        company_id: companyId,
        classification: classification,
        title: formData.title,
        team: formData.team,
        status: formData.status,
        priority: formData.priority,
        lead: formData.lead || null,
        assignee: formData.assignee || null,
        deadline: formData.deadline || null,
        description: formData.description || null,
      })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      resetForm()
      onTaskCreated()
      onClose()
    } catch (error) {
      console.error("Error creating task:", error)
      alert("Failed to create task. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-slide-up">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-900">Create New Task</h2>
          <p className="text-xs text-slate-500 mt-1">
            Add a new task to your <span className="font-semibold text-[#FF6B35]">{classification}</span> workspace
          </p>
        </div>

        {/* Quick Create Button */}
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#C44569] shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white mb-0.5">⚡ Quick Create</h3>
              <p className="text-xs text-white/90">
                Create <span className="font-semibold">{classification} Workflow</span> instantly
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickCreate}
              disabled={quickCreateLoading}
              className="px-6 py-3 rounded-lg bg-white text-[#6C5CE7] font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap"
            >
              {quickCreateLoading ? "Creating..." : "Create Now"}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs font-semibold text-slate-500">OR CUSTOMIZE</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Team *
              </label>
              <select
                required
                value={formData.team}
                onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              >
                <option value="">Select team</option>
                <option value="ALL">ALL</option>
                <option value="Design">Design</option>
                <option value="UI/UX">UI/UX</option>
                <option value="Development">Development</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Priority *
              </label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Status *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lead
              </label>
              <input
                type="text"
                value={formData.lead}
                onChange={(e) => setFormData({ ...formData, lead: e.target.value })}
                placeholder="Task lead name"
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assignee
              </label>
              <input
                type="text"
                value={formData.assignee}
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                placeholder="Assigned to"
                className="w-full h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the task..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/10 outline-none transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-10 rounded-lg border-2 border-slate-300 text-[#6C5CE7] text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#C44569] text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}