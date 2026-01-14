"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Globe, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function CompanyWebsitePage() {
  const [companyWebsite, setCompanyWebsite] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user has completed step 1
    const checkProgress = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('company_name, company_website')
        .eq('user_id', user.id)
        .single()

      if (!company?.company_name) {
        router.push('/onboarding/company-name')
        return
      }

      if (company.company_website) {
        setCompanyWebsite(company.company_website)
      }
    }

    checkProgress()
  }, [router])

  const handleContinue = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      await supabase
        .from('companies')
        .update({ 
          company_website: companyWebsite.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      router.push('/onboarding/company-description')
    } catch (error) {
      console.error('Error saving company website:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    handleContinue()
  }

  const handleBack = () => {
    router.push('/onboarding/company-name')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#5B4BC4] flex items-center justify-center shadow-lg shadow-[#6C5CE7]/30">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div className="flex gap-2">
              <div className="w-16 h-1.5 rounded-full bg-slate-300"></div>
              <div className="w-16 h-1.5 rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#5B4BC4]"></div>
              <div className="w-16 h-1.5 rounded-full bg-slate-200"></div>
            </div>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Got a website yet?
          </h1>
          <p className="text-lg text-slate-600">
            Share your company's online presence. No website? No problem—just skip this step.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-8 sm:p-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-6">
            <div>
              <label htmlFor="companyWebsite" className="block text-sm font-semibold text-slate-700 mb-3">
                Website URL <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="companyWebsite"
                type="url"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                placeholder="https://yourcompany.com"
                className="w-full h-16 px-6 rounded-2xl border-2 border-slate-200 focus:border-[#6C5CE7] focus:ring-4 focus:ring-[#6C5CE7]/10 outline-none text-lg transition-all duration-200"
                autoFocus
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleContinue}
                disabled={isLoading}
                size="lg"
                className="flex-1 h-16 rounded-2xl text-lg font-semibold bg-gradient-to-r from-[#6C5CE7] to-[#5B4BC4] hover:from-[#6C5CE7] hover:to-[#6C5CE7] shadow-lg shadow-[#6C5CE7]/30 hover:shadow-xl hover:shadow-[#6C5CE7]/40 transition-all duration-200"
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
              
              <Button
                onClick={handleSkip}
                disabled={isLoading}
                size="lg"
                variant="outline"
                className="h-16 rounded-2xl px-8 text-lg font-semibold border-2 border-slate-300 hover:border-[#6C5CE7] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/5 transition-all duration-200"
              >
                Skip
              </Button>
            </div>

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
            Step 2 of 3 • Takes less than 2 minutes
          </p>
        </div>
      </div>
    </div>
  )
}