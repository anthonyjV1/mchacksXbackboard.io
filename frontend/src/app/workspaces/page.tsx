// app/workspaces/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkspaceShell } from "@/components/workspaces/WorkspaceShell"

export default async function WorkspacesPage() {
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
    redirect("/onboarding/company-name")
  }

  const primaryCompany = companies[0]

  return (
    <WorkspaceShell
      companies={companies}
      primaryCompany={primaryCompany}
      userId={user.id}
    />
  )
}