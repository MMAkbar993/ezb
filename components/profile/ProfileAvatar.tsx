'use client'

import React, { useState, useRef, useEffect } from 'react'
import { uploadProfileAvatar, removeProfileAvatar } from '@/lib/supabase/profile-image'

interface ProfileAvatarProps {
  userId: string
  avatarUrl?: string | null
  fullName?: string
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  onUpdate?: (url: string | null) => void
  editable?: boolean
}

export function ProfileAvatar({
  userId,
  avatarUrl,
  fullName = 'User',
  size = 'medium',
  onUpdate,
  editable = true
}: ProfileAvatarProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(avatarUrl || null)
  const [uploading, setUploading] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Keep local state in sync when the parent re-fetches the profile
  // (e.g. after an upload triggers onUpdate -> getUser()).
  useEffect(() => {
    setImageUrl(avatarUrl || null)
    setImgFailed(false)
  }, [avatarUrl])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await uploadProfileAvatar(userId, file)
      if (result.success && result.url) {
        setImageUrl(result.url)
        setImgFailed(false)
        onUpdate?.(result.url)
      } else {
        alert(result.error || 'Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove your profile photo?')) return
    
    setUploading(true)
    try {
      const result = await removeProfileAvatar(userId)
      if (result.success) {
        setImageUrl(null)
        setImgFailed(false)
        onUpdate?.(null)
      } else {
        alert(result.error || 'Failed to remove image')
      }
    } catch (error) {
      console.error('Error removing avatar:', error)
      alert('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }

  const getSizeClass = () => {
    switch(size) {
      case 'small': return 'avatar-small'
      case 'large': return 'avatar-large'
      case 'xlarge': return 'avatar-xlarge'
      default: return 'avatar-medium'
    }
  }

  const getInitials = () => {
    return fullName
      .trim()
      .split(/\s+/)
      .map(name => name?.[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={`profile-avatar-wrapper ${getSizeClass()}`}>
      <div className="avatar-container">
        {imageUrl && !imgFailed ? (
          <img 
            src={imageUrl} 
            alt={fullName}
            className="avatar-image"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="avatar-placeholder">
            {getInitials()}
          </div>
        )}
        
        {editable && (
          <div className="avatar-overlay">
            <button 
              className="avatar-edit-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳' : '📷'}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {editable && imageUrl && (
        <button 
          className="avatar-remove-btn"
          onClick={handleRemove}
          disabled={uploading}
        >
          ✕
        </button>
      )}
    </div>
  )
}
