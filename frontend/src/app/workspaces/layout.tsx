import { WorkspaceSidebar } from "@/components/workspaces/WorkspaceSidebar"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
  
    if (!user) {
      redirect("/")
    }
  
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("user_id", user.id)
  
    if (error || !companies || companies.length === 0) {
      // Redirect to onboarding if no company found
      redirect("/onboarding/company-name")
    }
  
    const primaryCompany = companies[0]  
  return (
    <main className="relative flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,107,53,0.10),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(76,92,231,0.10),_transparent_55%)]" />
      
      <div className="relative z-10 flex h-full overflow-hidden border-slate-200 bg-white/80">
        <WorkspaceSidebar companies={companies} primaryCompany={primaryCompany} />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </main>
  )
}