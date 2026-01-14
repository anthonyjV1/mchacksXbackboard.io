"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowLeft, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function CompanyDescriptionPage() {
  const [companyDescription, setCompanyDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    // Check if user has completed previous steps
    const checkProgress = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('company_name, company_description')
        .eq('user_id', user.id)
        .single()

      if (!company?.company_name) {
        router.push('/onboarding/company-name')
        return
      }

      if (company.company_description) {
        setCompanyDescription(company.company_description)
        setCharCount(company.company_description.length)
      }
    }

    checkProgress()
  }, [router])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setCompanyDescription(text)
    setCharCount(text.length)
  }

  const handleComplete = async () => {
  if (!companyDescription.trim()) return

  setIsLoading(true)
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // Update company description
    const { data: company } = await supabase
      .from('companies')
      .update({ 
        company_description: companyDescription.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select('id')
      .single()

    if (!company) throw new Error('Company not found')

    // Create default "First Workspace" workflow
    const { data: firstWorkspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        user_id: user.id,
        company_id: company.id,
        classification: 'Roadmap',
        title: 'First Workspace',
        team: 'All',
        status: 'In Progress',
        priority: 'Medium',
        description: 'Your first pipeline workspace. Start building your workflow here!',
      })
      .select('id')
      .single()

    if (workspaceError) throw workspaceError

    // Redirect to the new workspace's dashboard
    router.push(`/dashboard/${firstWorkspace.id}`)
  } catch (error) {
    console.error('Error completing onboarding:', error)
    alert('Something went wrong. Please try again.')
  } finally {
    setIsLoading(false)
  }
}

  const handleBack = () => {
    router.push('/onboarding/company-website')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4ECDC4] to-[#3BB5AD] flex items-center justify-center shadow-lg shadow-[#4ECDC4]/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex gap-2">
              <div className="w-16 h-1.5 rounded-full bg-slate-300"></div>
              <div className="w-16 h-1.5 rounded-full bg-slate-300"></div>
              <div className="w-16 h-1.5 rounded-full bg-gradient-to-r from-[#4ECDC4] to-[#3BB5AD]"></div>
            </div>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Tell us about your vision
          </h1>
          <p className="text-lg text-slate-600">
            What problem are you solving? What makes your company unique? Share your story.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-8 sm:p-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-6">
            <div>
              <label htmlFor="companyDescription" className="block text-sm font-semibold text-slate-700 mb-3">
                Company Description
              </label>
              <textarea
                id="companyDescription"
                value={companyDescription}
                onChange={handleChange}
                placeholder="We're building a platform that helps..."
                rows={6}
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-[#4ECDC4] focus:ring-4 focus:ring-[#4ECDC4]/10 outline-none text-lg transition-all duration-200 resize-none"
                autoFocus
              />
              <div className="flex justify-between items-center mt-2 px-2">
                <p className="text-sm text-slate-500">
                  {charCount === 0 ? "Start typing..." : "Looking good! Keep going."}
                </p>
                <p className="text-sm text-slate-400">
                  {charCount} characters
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#4ECDC4]/10 to-[#3BB5AD]/10 rounded-2xl p-6 border border-[#4ECDC4]/20">
              <p className="text-sm text-slate-700 leading-relaxed">
                <strong className="text-[#4ECDC4]">Pro tip:</strong> Focus on what problem you solve and what steps you take to solve that problem. How does it all come together? It's all in the details!
              </p>
            </div>

            <Button
              onClick={handleComplete}
              disabled={!companyDescription.trim() || isLoading}
              size="lg"
              className="w-full h-16 rounded-2xl text-lg font-semibold bg-gradient-to-r from-[#4ECDC4] to-[#3BB5AD] hover:from-[#4ECDC4] hover:to-[#4ECDC4] shadow-lg shadow-[#4ECDC4]/30 hover:shadow-xl hover:shadow-[#4ECDC4]/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                "Completing..."
              ) : (
                <>
                  Complete Setup
                  <Check className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <Button
              onClick={handleBack}
              variant="ghost"
              className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        <div className="mt-8 text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-sm text-slate-500">
            Step 3 of 3 • Almost there! 🎉
          </p>
        </div>
      </div>
    </div>
  )
}