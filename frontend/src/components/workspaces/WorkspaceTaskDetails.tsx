"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Calendar, User, FileText, ChevronRight, Send, Trash2, ExternalLink, Edit2, Check, X } from "lucide-react"

interface TaskDetails {
  id: string
  title: string
  team: string
  status: string
  priority: string
  lead: string | null
  assignee: string | null
  deadline: string | null
  description: string | null
  created_at: string
  updated_at: string
}

interface Comment {
  id: string
  task_id: string
  user_id: string
  user_email: string
  content: string
  created_at: string
}

interface Props {
  selectedId: string | null
  onTaskUpdated?: () => void
}

export function WorkspaceTaskDetails({ selectedId, onTaskUpdated }: Props) {
  const [task, setTask] = useState<TaskDetails | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!selectedId) {
      setTask(null)
      setComments([])
      return
    }
    setIsOpen(true)
    const fetchTaskDetails = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("workspaces").select("*").eq("id", selectedId).single()
        if (error) throw error
        setTask(data)
        const { data: commentsData, error: commentsError } = await supabase.from("workspace_comments").select("*").eq("task_id", selectedId).order("created_at", { ascending: true })
        if (commentsError) throw commentsError
        setComments(commentsData || [])
      } catch (error) {
        console.error("Error fetching task details:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchTaskDetails()
  }, [selectedId])

  const startEditing = (field: string, currentValue: any) => {
    setEditingField(field)
    setEditValue(currentValue || "")
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditValue("")
  }

  const saveEdit = async () => {
    if (!task || !editingField) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("workspaces").update({ [editingField]: editValue || null }).eq("id", task.id)
      if (error) throw error
      setTask({ ...task, [editingField]: editValue || null })
      setEditingField(null)
      setEditValue("")
      
      // Trigger parent refresh
      if (onTaskUpdated) {
        onTaskUpdated()
      }
    } catch (error) {
      console.error("Error updating task:", error)
      alert("Failed to update task")
    } finally {
      setSaving(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedId) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from("workspace_comments").insert({ task_id: selectedId, user_id: user.id, user_email: user.email, content: newComment.trim() }).select().single()
      if (error) throw error
      setComments([...comments, data])
      setNewComment("")
    } catch (error) {
      console.error("Error adding comment:", error)
      alert("Failed to add comment")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("workspace_comments").delete().eq("id", commentId)
      if (error) throw error
      setComments(comments.filter(c => c.id !== commentId))
    } catch (error) {
      console.error("Error deleting comment:", error)
      alert("Failed to delete comment")
    } finally {
      setDeletingId(null)
    }
  }

  if (!isOpen) {
    return (
      <div className="relative">
        <button onClick={() => setIsOpen(true)} className="fixed right-0 top-1/2 -translate-y-1/2 w-6 h-16 bg-white border border-r-0 border-slate-200 rounded-l-lg flex items-center justify-center hover:bg-slate-50 transition-colors shadow-md z-50">
          <ChevronRight className="w-4 h-4 text-slate-600 rotate-180" />
        </button>
      </div>
    )
  }

  if (!selectedId || !task) {
    return (
      <aside className="relative flex h-full w-80 flex-col border-l border-slate-200 bg-white px-6 py-6">
        <button onClick={() => setIsOpen(false)} className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 w-6 h-16 bg-white border border-r-0 border-slate-200 rounded-l-lg flex items-center justify-center hover:bg-slate-50 transition-colors shadow-md z-10">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-4">
            <div className="flex justify-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#C44569] opacity-20"></div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#5B4BC4] opacity-20"></div>
            </div>
            <p className="text-sm text-slate-500">Select a task to view details</p>
          </div>
        </div>
      </aside>
    )
  }

  if (loading) {
    return (
      <aside className="relative flex h-full w-80 flex-col border-l border-slate-200 bg-white px-6 py-6">
        <button onClick={() => setIsOpen(false)} className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 w-6 h-16 bg-white border border-r-0 border-slate-200 rounded-l-lg flex items-center justify-center hover:bg-slate-50 transition-colors shadow-md z-50">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex h-full items-center justify-center text-slate-400">
          <p className="text-sm">Loading...</p>
        </div>
      </aside>
    )
  }

  const priorityColors = {
    High: { bg: "from-[#FF6B35] to-[#C44569]", text: "text-[#FF6B35]", light: "bg-[#FF6B35]/10", border: "border-[#FF6B35]/30" },
    Medium: { bg: "from-[#FFE66D] to-[#FFA500]", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-200" },
    Low: { bg: "from-[#4ECDC4] to-[#3BB5AD]", text: "text-emerald-600", light: "bg-emerald-50", border: "border-emerald-200" }
  }

  const statusColors: Record<string, string> = {
    "To Do": "bg-slate-100 text-slate-700 border-slate-200",
    "In Progress": "bg-sky-100 text-sky-700 border-sky-200",
    "Ongoing": "bg-purple-100 text-purple-700 border-purple-200",
    "Done": "bg-emerald-100 text-emerald-700 border-emerald-200"
  }

  const priority = priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.Medium

  return (
    <aside className="relative flex h-full w-80 flex-col bg-gradient-to-b from-slate-100 to-slate-200 border-l border-slate-300 shadow-xl">
      <button onClick={() => setIsOpen(false)} className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 w-6 h-16 bg-white border border-r-0 border-slate-200 rounded-l-lg flex items-center justify-center hover:bg-slate-50 transition-colors shadow-md z-50">
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-slate-200 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editingField === 'title' ? (
                <div className="space-y-2">
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 text-xl font-bold border-2 border-[#FF6B35] rounded-lg focus:outline-none" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-4 h-4" /></button>
                    <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEditing('title', task.title)} className="group cursor-pointer">
                  <div className="flex items-start gap-2">
                    <h2 className="text-xl font-bold text-slate-900 leading-tight mb-1 flex-1">{task.title}</h2>
                    <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Pipeline Block</p>
                </div>
              )}
            </div>
            <button 
            onClick={() => window.location.href = `/dashboard/${task.id}`}
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#C44569] text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5">
              <span>Open</span><ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl bg-white border-2 ${statusColors[task.status]?.includes('bg-slate') ? 'border-slate-200' : statusColors[task.status]?.includes('bg-sky') ? 'border-sky-200' : statusColors[task.status]?.includes('bg-purple') ? 'border-purple-200' : 'border-emerald-200'} p-3 shadow-sm`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Status</p>
              {editingField === 'status' ? (
                <div className="space-y-2">
                  <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 text-xs font-bold border-2 border-[#FF6B35] rounded-lg focus:outline-none" autoFocus>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Done">Done</option>
                  </select>
                  <div className="flex gap-1">
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-3 h-3" /></button>
                    <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEditing('status', task.status)} className="group cursor-pointer">
                  <div className="flex items-center gap-1">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${statusColors[task.status] || statusColors["To Do"]} border`}>{task.status}</span>
                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
            </div>
            <div className={`rounded-xl bg-white border-2 ${priority.border} p-3 shadow-sm`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Priority</p>
              {editingField === 'priority' ? (
                <div className="space-y-2">
                  <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 text-xs font-bold border-2 border-[#FF6B35] rounded-lg focus:outline-none" autoFocus>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <div className="flex gap-1">
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-3 h-3" /></button>
                    <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEditing('priority', task.priority)} className="group cursor-pointer">
                  <div className="flex items-center gap-1">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${priority.light} ${priority.text} border ${priority.border}`}>{task.priority}</span>
                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white border-2 border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Team</p>
            <div className="space-y-2.5 text-sm">
              {editingField === 'team' ? (
                <div className="space-y-2">
                  <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-3 py-2 text-sm border-2 border-[#FF6B35] rounded-lg focus:outline-none" autoFocus>
                    <option value="All">All</option>
                    <option value="Design">Design</option>
                    <option value="UI/UX">UI/UX</option>
                    <option value="Development">Development</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-4 h-4" /></button>
                    <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEditing('team', task.team)} className="group cursor-pointer flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6C5CE7] to-[#5B4BC4] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{task.team.charAt(0)}</div>
                  <span className="text-slate-900 font-semibold flex-1">{task.team}</span>
                  <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              
              {editingField === 'lead' ? (
                <div className="space-y-2 px-3 py-2">
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Lead name" className="w-full px-2 py-1 text-xs border-2 border-[#FF6B35] rounded-lg focus:outline-none" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-3 h-3" /></button>
                    <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEditing('lead', task.lead)} className="group cursor-pointer flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">
                  <User className="w-4 h-4 text-[#FF6B35]" />
                  <span className="text-slate-600 text-xs flex-1">Lead: <span className="font-semibold text-slate-900">{task.lead || 'Not set'}</span></span>
                  <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              
              {editingField === 'assignee' ? (
                <div className="space-y-2 px-3 py-2">
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Assignee name" className="w-full px-2 py-1 text-xs border-2 border-[#FF6B35] rounded-lg focus:outline-none" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-3 h-3" /></button>
                    <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEditing('assignee', task.assignee)} className="group cursor-pointer flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">
                  <User className="w-4 h-4 text-[#4ECDC4]" />
                  <span className="text-slate-600 text-xs flex-1">Assignee: <span className="font-semibold text-slate-900">{task.assignee || 'Not set'}</span></span>
                  <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white border-2 border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-[#FFE66D]" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timeline</p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between px-2 py-1">
                <span className="text-slate-500 font-medium">Created</span>
                <span className="font-semibold text-slate-700">{new Date(task.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between px-2 py-1">
                <span className="text-slate-500 font-medium">Updated</span>
                <span className="font-semibold text-slate-700">{new Date(task.updated_at).toLocaleDateString()}</span>
              </div>
              {editingField === "deadline" ? (
                <div className="space-y-2 px-2 py-2">
                    <input
                    type="date"
                    value={editValue ?? ""}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-2 py-1 text-xs border-2 border-[#FF6B35] rounded-lg focus:outline-none"
                    autoFocus
                    />
                    <div className="flex gap-2">
                    <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                    >
                        <Check className="w-3 h-3" />
                    </button>
                    <button
                        onClick={cancelEditing}
                        className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                    >
                        <X className="w-3 h-3" />
                    </button>
                    </div>
                </div>
                ) : (
                <div
                    onClick={() => startEditing("deadline", task.deadline ?? "")}
                    className="group cursor-pointer flex justify-between px-2 py-2 mt-2 bg-gradient-to-r from-[#FF6B35]/10 to-[#C44569]/10 rounded-lg border border-[#FF6B35]/20 hover:from-[#FF6B35]/20 hover:to-[#C44569]/20 transition-colors"
                >
                    <span className="text-[#FF6B35] font-semibold">⏰ Deadline</span>
                    <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                        {task.deadline
                        ? task.deadline
                        : "Not set"}
                    </span>
                    <Edit2 className="w-3 h-3 text-[#FF6B35] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
                )}
            </div>
          </div>

          <div className="rounded-xl bg-white border-2 border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#6C5CE7]" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</p>
            </div>
            {editingField === 'description' ? (
              <div className="space-y-2">
                <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Add description..." rows={4} className="w-full px-3 py-2 text-sm border-2 border-[#FF6B35] rounded-lg focus:outline-none resize-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check className="w-4 h-4" /></button>
                  <button onClick={cancelEditing} className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <div onClick={() => startEditing('description', task.description)} className="group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors relative">
                <p className="text-sm text-slate-700 leading-relaxed">{task.description || 'Click to add description...'}</p>
                <Edit2 className="absolute top-2 right-2 w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border-2 border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">💬 Comments</p>
            <div className="space-y-3 mb-3">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="group bg-slate-50 rounded-lg p-3 border border-slate-200 relative">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4ECDC4] to-[#3BB5AD] flex items-center justify-center text-white text-xs font-bold">{comment.user_email?.charAt(0).toUpperCase() || 'U'}</div>
                        <span className="text-xs font-semibold text-slate-700">{comment.user_email?.split('@')[0] || 'User'}</span>
                      </div>
                      <button onClick={() => handleDeleteComment(comment.id)} disabled={deletingId === comment.id} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">{comment.content}</p>
                    <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder="Add a comment..." className="flex-1 px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:border-[#FF6B35] focus:outline-none" />
              <button onClick={handleAddComment} disabled={!newComment.trim() || submitting} className="px-3 py-2 bg-gradient-to-r from-[#FF6B35] to-[#C44569] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}