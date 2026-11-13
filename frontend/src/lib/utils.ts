/** Account usernames are stored lowercase; show them as a name. */
export function displayName(username?: string, fallback = "Owner") {
  if (!username) return fallback
  return username.charAt(0).toUpperCase() + username.slice(1)
}
