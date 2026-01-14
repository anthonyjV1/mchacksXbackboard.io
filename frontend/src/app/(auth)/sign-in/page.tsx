'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { FloatingBlocks } from '@/components/FloatingBlocks'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/workspaces')
    router.refresh()
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF6B35]/10 via-[#6C5CE7]/10 to-[#4ECDC4]/10 overflow-hidden px-4">
      {/* Soft gradient glow background */}
      <FloatingBlocks />
      <div className="absolute -inset-16 bg-gradient-to-r from-[#FF6B35]/10 via-[#6C5CE7]/10 to-[#4ECDC4]/10 blur-3xl animate-pulse-slow pointer-events-none" />

      <div className="relative w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200/40 shadow-2xl shadow-[#FF6B35]/10 rounded-3xl p-8 space-y-8 z-10 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="flex justify-center items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#FF6B35]" />
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Let me back in!
            </h2>
            <Sparkles className="h-6 w-6 text-[#FF6B35]" />
          </div>
          <p className="text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="font-semibold text-[#6C5CE7] hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSignIn}>
          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl shadow-inner bg-white/80 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50 focus:border-[#FF6B35]/40 transition-all sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl shadow-inner bg-white/80 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/50 focus:border-[#6C5CE7]/40 transition-all sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-[#FF6B35] hover:text-[#6C5CE7]"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-[#FF6B35] via-[#C44569] to-[#6C5CE7] hover:from-[#FF6B35] hover:to-[#FF6B35] shadow-lg shadow-[#FF6B35]/30 hover:shadow-2xl hover:shadow-[#FF6B35]/40 transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
