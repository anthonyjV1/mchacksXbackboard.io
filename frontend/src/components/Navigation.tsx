import { createClient } from '@/lib/supabase/server'
import { NavigationClient } from './NavigationClient'

export async function Navigation() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <NavigationClient user={user} />
}