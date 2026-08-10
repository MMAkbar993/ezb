import { supabase } from './client'

export async function uploadProfileAvatar(
  userId: string,
  file: File
) {
  try {
    console.log('Starting upload for user:', userId)
    
    // Validate file
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 2MB')
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPG, PNG, and WebP images are allowed')
    }

    // Upload to storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`
    
    console.log('Uploading to storage:', fileName)
    
    const { data, error: uploadError } = await supabase.storage
      .from('profile_images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile_images')
      .getPublicUrl(fileName)

    console.log('Public URL:', publicUrl)

    // Update profile using RPC
    const { error: updateError } = await supabase.rpc('update_profile_avatar', {
      p_user_id: userId,
      p_avatar_url: publicUrl,
      p_avatar_thumb_url: publicUrl
    })

    if (updateError) {
      console.error('RPC update error:', updateError)
      throw updateError
    }

    console.log('✅ Avatar updated successfully!')
    
    return {
      success: true,
      url: publicUrl,
      message: 'Profile photo updated successfully'
    }

  } catch (error: any) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload profile photo'
    }
  }
}

export async function removeProfileAvatar(userId: string) {
  try {
    console.log('Removing avatar for user:', userId)
    
    // Update profile to remove avatar URLs
    const { error: updateError } = await supabase.rpc('update_profile_avatar', {
      p_user_id: userId,
      p_avatar_url: null,
      p_avatar_thumb_url: null
    })

    if (updateError) {
      console.error('Remove error:', updateError)
      throw updateError
    }

    console.log('✅ Avatar removed successfully!')
    
    return {
      success: true,
      message: 'Profile photo removed successfully'
    }

  } catch (error: any) {
    console.error('Remove error:', error)
    return {
      success: false,
      error: error.message || 'Failed to remove profile photo'
    }
  }
}
