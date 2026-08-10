import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Listing image upload
// Uses the 'listing_images' storage bucket (must be created in Supabase:
// Dashboard -> Storage -> New bucket -> name: listing_images -> Public).
// ---------------------------------------------------------------------------

const BUCKET = 'listing_images'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface ListingImageResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

/**
 * Check whether the 'listing_images' bucket exists.
 * Supabase storage throws 400/404 "bucket not found" if it does not,
 * so we surface a helpful message instead of a cryptic one.
 */
export async function ensureListingBucket(): Promise<{ exists: boolean; error?: string }> {
  const { data, error } = await supabase.storage.getBucket(BUCKET)
  if (error) {
    return { exists: false, error: error.message }
  }
  return { exists: !!data }
}

export async function uploadListingImage(
  listingId: string,
  file: File,
  index = 0
): Promise<ListingImageResult> {
  // 1. Validate the file before hitting the network
  if (!file) {
    return { success: false, error: 'No file provided' }
  }
  if (file.size > MAX_SIZE) {
    return { success: false, error: `Image must be less than ${MAX_SIZE / 1024 / 1024}MB` }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Only JPG, PNG, and WebP images are allowed' }
  }

  // 2. Confirm the bucket exists — give a clear error if not
  const bucket = await ensureListingBucket()
  if (!bucket.exists) {
    return {
      success: false,
      error: `Storage bucket '${BUCKET}' not found. Create it in Supabase: Dashboard -> Storage -> New bucket -> name: ${BUCKET} -> Public. (Detail: ${bucket.error || 'missing'})`,
    }
  }

  // 3. Derive path: listingId/image-<index>.<ext>
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${listingId}/image-${index}.${ext}`

  // 4. Upload with upsert so re-uploads overwrite cleanly
  const { error: uploadError, data } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    // Clean up any partial object if the upload half-completed
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    return { success: false, error: uploadError.message }
  }

  // 5. Build a shareable public URL (bucket is public, so this is stable)
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = urlData?.publicUrl

  return {
    success: true,
    url,
    path: (data as { path?: string } | null)?.path || path,
  }
}

/**
 * Upload multiple images for a listing in order.
 * Returns the URLs of the successfully-uploaded images.
 */
export async function uploadListingImages(
  listingId: string,
  files: File[]
): Promise<{ success: boolean; urls: string[]; error?: string }> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const result = await uploadListingImage(listingId, files[i], i)
    if (result.success && result.url) {
      urls.push(result.url)
    } else {
      // Stop on first failure and report it (partial uploads remain cleaned by caller)
      return { success: false, urls, error: result.error || `Failed to upload image ${i + 1}` }
    }
  }
  return { success: true, urls }
}

/**
 * Remove an image from storage.
 */
export async function deleteListingImage(path: string): Promise<{ success: boolean; error?: string }> {
  if (!path) return { success: true }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}
