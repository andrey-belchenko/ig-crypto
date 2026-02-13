/**
 * Calculates SHA256 hash for a single file
 */
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Prepares legal document by calculating SHA256 hashes for all files
 * @param files Array of File objects to process
 * @returns Promise resolving to array of SHA256 hash strings (hex-encoded)
 */
export async function prepareLegalDocument(files: File[]): Promise<string[]> {
  if (files.length === 0) {
    return []
  }

  try {
    // Calculate hashes in parallel for better performance
    const hashPromises = files.map(file => calculateFileHash(file))
    const hashes = await Promise.all(hashPromises)
    return hashes
  } catch (error) {
    throw new Error(`Failed to calculate file hashes: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
