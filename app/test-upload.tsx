'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function TestUpload() {
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const testUpload = async () => {
    setStatus('Testing connection...')
    setError('')
    
    try {
      // Test 1: Check if we can get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error(`Auth error: ${userError.message}`)
      if (!user) throw new Error('Not signed in')
      
      setStatus(`✅ User: ${user.email}`)
      
      // Test 2: Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileError) throw new Error(`Profile error: ${profileError.message}`)
      
      setStatus(`✅ Profile found: ${profile.full_name || 'No name'}`)
      
      // Test 3: Check if avatar columns exist
      const hasAvatar = profile.avatar_url !== undefined
      setStatus(`✅ Avatar columns exist: ${hasAvatar}`)
      
      // Test 4: Try to update with a test URL
      const testUrl = 'https://ui-avatars.com/api/?name=Test&size=128'
      const { error: updateError } = await supabase.rpc('update_profile_avatar', {
        p_user_id: user.id,
        p_avatar_url: testUrl,
        p_avatar_thumb_url: testUrl
      })
      
      if (updateError) throw new Error(`Update error: ${updateError.message}`)
      
      setStatus('✅ Avatar updated successfully!')
      setImageUrl(testUrl)
      
    } catch (err: any) {
      setError(err.message || 'Unknown error')
      setStatus('❌ Failed')
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Avatar Upload Test</h1>
      
      <button
        onClick={testUpload}
        style={{
          padding: '10px 20px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Run Test
      </button>
      
      <div style={{ marginTop: '20px', padding: '16px', background: '#f0f4f8', borderRadius: '8px' }}>
        <p><strong>Status:</strong> {status}</p>
        {error && <p style={{ color: 'red' }}><strong>Error:</strong> {error}</p>}
        {imageUrl && (
          <div>
            <p><strong>Test Image:</strong></p>
            <img src={imageUrl} alt="Test" style={{ width: '100px', height: '100px', borderRadius: '50%' }} />
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '20px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
        <p><strong>Info:</strong></p>
        <p>Check the browser console (F12) for detailed errors</p>
        <p>Check the Network tab to see API requests</p>
      </div>
    </div>
  )
}
