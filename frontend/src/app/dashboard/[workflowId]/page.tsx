import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import WorkflowDashboardClient from './WorkflowDashboardClient'

export default async function WorkflowDashboardPage({ 
  params 
}: { 
  params: Promise<{ workflowId: string }> 
}) {
  // Await params in Next.js 15
  const { workflowId } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  // Get company info
  const { data: company } = await supabase
    .from('companies')
    .select('company_name')
    .eq('user_id', user.id)
    .single()

  if (!company) {
    redirect('/onboarding/company-name')
  }

  // Get the specific workflow
  const { data: workflow, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workflowId)
    .eq('user_id', user.id)
    .single()

  if (error || !workflow) {
    notFound()
  }

  // Fetch existing pipeline blocks for this workspace
  const { data: savedBlocks } = await supabase
    .from('pipeline_blocks')
    .select('*')
    .eq('workspace_id', workflowId)
    .order('position', { ascending: true })

  return (
    <WorkflowDashboardClient 
      workflow={workflow} 
      initialBlocks={savedBlocks || []}
    />
  )
}