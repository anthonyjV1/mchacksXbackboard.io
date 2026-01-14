"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Building2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function CompanyNamePage() {
  const [companyName, setCompanyName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleContinue = async () => {
    if (!companyName.trim()) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check if company exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existingCompany) {
        // Update existing company
        await supabase
          .from('companies')
          .update({ 
            company_name: companyName.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
      } else {
        // Create new company
        await supabase
          .from('companies')
          .insert({
            user_id: user.id,
            email: user.email,
            company_name: companyName.trim()
          })
      }

      router.push('/onboarding/company-website')
    } catch (error) {
      console.error('Error saving company name:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#C44569] flex items-center justify-center shadow-lg shadow-[#FF6B35]/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex gap-2">
              <div className="w-16 h-1.5 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#C44569]"></div>
              <div className="w-16 h-1.5 rounded-full bg-slate-200"></div>
              <div className="w-16 h-1.5 rounded-full bg-slate-200"></div>
            </div>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            What's your company called?
          </h1>
          <p className="text-lg text-slate-600">
            Let's start with the basics. Don't worry, you can always change this later.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-8 sm:p-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-6">
            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 mb-3">
                Company Name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                placeholder="Enter your company name"
                className="w-full h-16 px-6 rounded-2xl border-2 border-slate-200 focus:border-[#FF6B35] focus:ring-4 focus:ring-[#FF6B35]/10 outline-none text-lg transition-all duration-200"
                autoFocus
              />
            </div>

            <Button
              onClick={handleContinue}
              disabled={!companyName.trim() || isLoading}
              size="lg"
              className="w-full h-16 rounded-2xl text-lg font-semibold bg-gradient-to-r from-[#FF6B35] to-[#C44569] hover:from-[#FF6B35] hover:to-[#FF6B35] shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:shadow-[#FF6B35]/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                "Saving..."
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-8 text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-sm text-slate-500">
            Step 1 of 3 • Takes less than 2 minutes
          </p>
        </div>
      </div>
    </div>
  )
}