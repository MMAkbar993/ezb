import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if we're using the new publishable key format (starts with sb_)
const isPublishableKey = supabaseAnonKey.startsWith('sb_')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  // For publishable keys, we need to send the apikey header on every request.
  // supabase-js v2 expects default headers under `global.headers`.
  global: isPublishableKey ? {
    headers: {
      'apikey': supabaseAnonKey,
    },
  } : undefined,
})

// For debugging
console.log('🔑 Supabase client initialized with key type:', 
  isPublishableKey ? 'Publishable (sb_)' : 'Legacy (eyJ)'
)
