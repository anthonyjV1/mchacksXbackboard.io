import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  console.log('=== CALLBACK DEBUG ===')
  console.log('Full URL:', requestUrl.href)
  console.log('Code:', code)
  console.log('Next:', next)
  console.log('All params:', Object.fromEntries(requestUrl.searchParams))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('Exchange result - Error:', error)
    console.log('Exchange result - Session:', data?.session ? 'EXISTS' : 'NULL')
    
    if (!error && data.session) {
      const redirectUrl = new URL(next, request.url)
      console.log('Redirecting to:', redirectUrl.href)
      return NextResponse.redirect(redirectUrl)
    }
    
    console.log('Exchange failed, redirecting to sign-in')
  } else {
    console.log('No code found, redirecting to sign-in')
  }

  return NextResponse.redirect(new URL('/sign-in', request.url))
}