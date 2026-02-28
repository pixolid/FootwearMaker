/**
 * Generate a Pixogen-compatible filename.
 * Format: {YYYYMMDDHHMMSS}_{prefix}_{name}
 * Example: 20260222143022_footwearapp_shoe
 */
export function generateFilename(prefix: string, name: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const dateTime = `${year}${month}${day}${hours}${minutes}${seconds}`
  return `${dateTime}_${prefix}_${name}`
}
