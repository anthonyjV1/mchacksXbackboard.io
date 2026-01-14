// Sidebar.tsx
"use client"

import { useState, useEffect } from "react"
import { Sparkles, ChevronRight, ChevronLeft, Search, Workflow } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { BLOCK_DEFINITIONS, BLOCK_CATEGORIES } from '@/lib/blocks/blockDefinitions'
import { BlockType } from '../../../types/pipeline'

interface SidebarProps {
  onAddBlock: (type: BlockType) => void
}

export function Sidebar({ onAddBlock }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("Loading...")
  const [userEmail, setUserEmail] = useState("")

  // Fetch company data from Supabase
  useEffect(() => {
    const fetchCompanyData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserEmail(user.email || "")
        
        const { data: company } = await supabase
          .from('companies')
          .select('company_name')
          .eq('user_id', user.id)
          .single()
        
        if (company) {
          setCompanyName(company.company_name)
        } else {
          setCompanyName("Your Company")
        }
      }
    }

    fetchCompanyData()
  }, [])

  const filteredBlocks = BLOCK_DEFINITIONS.filter(block => {
    const matchesSearch = block.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         block.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !activeCategory || block.category === activeCategory
    return matchesSearch && matchesCategory
  })

  if (!isOpen) {
    return (
      <>
        <div className="fixed left-0 top-0 h-screen w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent z-30" />
        
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-40"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-3 space-y-3">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#C44569] flex items-center justify-center shadow-lg shadow-orange-500/30 cursor-pointer relative overflow-hidden group"
              title={companyName}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Sparkles className="w-6 h-6 text-white relative z-10" />
            </motion.div>

            <div className="w-12 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

            <Link href="/workspaces">
              <motion.div 
                whileHover={{ scale: 1.05, x: 2 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-gradient-to-br hover:from-slate-100 hover:to-slate-200 flex items-center justify-center cursor-pointer transition-all group shadow-sm hover:shadow-md"
                title="Workspaces"
              >
                <Workflow className="w-5 h-5 text-slate-500 group-hover:text-[#FF6B35] transition-colors" />
              </motion.div>
            </Link>

            <div className="w-12 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

            {BLOCK_DEFINITIONS.slice(0, 3).map((block) => (
              <motion.button
                key={block.type}
                whileHover={{ scale: 1.1, rotate: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onAddBlock(block.type as BlockType)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all shadow-sm hover:shadow-lg bg-gradient-to-br ${block.gradient}`}
                title={block.label}
              >
                <block.icon className="w-5 h-5 text-white" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.1, x: 2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="fixed left-[100px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center hover:border-[#FF6B35] hover:shadow-xl hover:shadow-orange-500/20 transition-all duration-300 z-50 shadow-lg"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </motion.button>
      </>
    )
  }

  return (
    <aside className="w-80 bg-white border-r-2 border-slate-100 flex flex-col h-screen relative shadow-xl shadow-slate-200/50 overflow-hidden">
      {/* Gradient border overlay */}
      <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-[#FF6B35]/20 via-[#C44569]/20 to-[#6C5CE7]/20 z-20" />
      
      {/* Animated gradient orbs in background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#FF6B35]/8 to-[#C44569]/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#4ECDC4]/8 to-[#6C5CE7]/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

      {/* Header */}
      <div className="p-6 border-b border-slate-200 backdrop-blur-sm relative z-10 bg-gradient-to-r from-slate-50/50 to-transparent">
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3 mb-2"
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B35] to-[#C44569] rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#C44569] flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
              {companyName}
            </h2>
            <p className="text-xs text-slate-500 truncate">{userEmail}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-all"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </motion.button>
        </motion.div>
      </div>

      {/* Back to Workspaces - Seamless */}
      <div className="px-4 py-3 relative z-10">
        <Link href="/workspaces">
          <motion.div 
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-slate-50 to-transparent hover:from-slate-100 hover:to-slate-50 transition-all duration-300 cursor-pointer border border-transparent hover:border-slate-200/50"
          >
            <div className="p-2 rounded-xl bg-white shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
              <Workflow className="w-4 h-4 text-slate-400 group-hover:text-[#FF6B35] transition-colors" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                My Workspaces
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </motion.div>
        </Link>
      </div>

      {/* Search Bar - Aesthetic AF */}
      <div className="px-4 pb-4 relative z-10">
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#FF6B35]/10 to-[#C44569]/10 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-[#FF6B35] transition-colors z-10" />
            <input 
              type="text" 
              placeholder="Search blocks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-2xl text-sm focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]/30 transition-all outline-none placeholder:text-slate-400 shadow-sm hover:shadow-md group-hover:bg-white"
            />
          </div>
        </motion.div>
      </div>

      {/* Category Pills */}
      <div className="px-4 pb-4 relative z-10">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              !activeCategory 
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#C44569] text-white shadow-lg shadow-orange-500/30' 
                : 'bg-white/70 text-slate-600 hover:bg-white border border-slate-200/50'
            }`}
          >
            All
          </motion.button>
          {BLOCK_CATEGORIES.map((cat) => (
            <motion.button
              key={cat}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#C44569] text-white shadow-lg shadow-orange-500/30' 
                  : 'bg-white/70 text-slate-600 hover:bg-white border border-slate-200/50'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Blocks Section */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 relative z-10 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {filteredBlocks.length > 0 ? (
            filteredBlocks.map((block, index) => (
              <motion.button
                key={block.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ x: 4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAddBlock(block.type as BlockType)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl text-left border border-transparent hover:border-slate-200/50 transition-all group relative overflow-hidden bg-white/40 backdrop-blur-sm hover:bg-white/80 hover:shadow-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className={`relative p-2.5 rounded-xl bg-gradient-to-br ${block.gradient} shadow-sm group-hover:shadow-md transition-all group-hover:scale-110 group-hover:rotate-6`}>
                  <block.icon size={18} className="text-white" />
                </div>
                
                <div className="relative flex-1">
                  <div className="text-sm font-bold text-slate-900 leading-tight">
                    {block.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight font-medium">
                    {block.description}
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileHover={{ opacity: 1, x: 0 }}
                  className="text-slate-400"
                >
                  <ChevronRight size={16} />
                </motion.div>
              </motion.button>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-slate-400 text-sm"
            >
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              No blocks found
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}