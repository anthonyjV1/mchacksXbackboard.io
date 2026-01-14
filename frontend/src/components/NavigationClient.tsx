"use client"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Box } from "lucide-react"
import Link from 'next/link'
import { User } from '@supabase/supabase-js'

export function NavigationClient({ user }: { user: User | null }) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-xl"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 2px 8px rgba(0,0,0,0.02)'
      }}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-12 lg:px-24">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#C44569] shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <Box className="w-5 h-5 text-white" />
          </motion.div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            Accelr Labs
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="hidden font-semibold text-slate-700 hover:text-[#FF6B35] hover:bg-[#FF6B35]/5 sm:inline-flex"
          >
            Examples
          </Button>
          {user ? (
            <>
              <Link href="/workspaces" className="font-semibold text-slate-700 hover:text-[#FF6B35] hover:bg-[#FF6B35]/5">
                Dashboard
              </Link>
              <span className="text-sm text-slate-600">{user.email}</span>
            </>
          ) : (
            <>
              <Link 
                href="/sign-in"
                className="font-semibold text-slate-700 hover:text-[#FF6B35] hover:bg-[#FF6B35]/5"
              >
                Sign in
              </Link>
              <Link 
                href="/sign-up"
                className="hidden sm:inline-flex h-11 rounded-xl px-6 font-semibold bg-gradient-to-r from-[#FF6B35] to-[#C44569] hover:shadow-lg hover:shadow-[#FF6B35]/30 transition-all duration-300 text-white items-center justify-center"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  )
}