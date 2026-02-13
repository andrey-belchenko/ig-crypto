/**
 * Utility functions for working with certificate subject names (DN format)
 */

/**
 * Parses a Distinguished Name (DN) string and extracts a readable name
 * 
 * Priority:
 * 1. SN (Surname) + G (Given Name) - for person certificates
 * 2. CN (Common Name) - for organization certificates
 * 3. Full DN string as fallback
 * 
 * @param dnString The DN string in format "SN=..., G=..., CN=..."
 * @returns A readable name extracted from the DN
 */
export function extractNameFromDN(dnString: string): string {
  if (!dnString || typeof dnString !== 'string') {
    return dnString || ''
  }

  // Parse DN fields
  const fields: Record<string, string> = {}
  
  // Handle quoted values and unquoted values
  // Pattern: KEY="value" (with escaped quotes "") or KEY=value
  // This regex handles quoted values that may contain commas
  const regex = /([A-Z]+)=("(?:[^"]|"")*"|[^,]+)/g
  let match
  
  while ((match = regex.exec(dnString)) !== null) {
    const key = match[1]
    let value = match[2]
    
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
      // Handle escaped quotes within quoted strings ("" becomes ")
      value = value.replace(/""/g, '"')
    }
    
    // Trim whitespace
    value = value.trim()
    
    if (value) {
      fields[key] = value
    }
  }

  // Priority 1: Try to extract person's name (SN + G)
  if (fields.SN && fields.G) {
    return `${fields.SN} ${fields.G}`.trim()
  }

  // Priority 2: Use Common Name (CN)
  if (fields.CN) {
    return fields.CN
  }

  // Priority 3: Use Surname alone if available
  if (fields.SN) {
    return fields.SN
  }

  // Priority 4: Use Given Name alone if available
  if (fields.G) {
    return fields.G
  }

  // Fallback: return original string
  return dnString
}
