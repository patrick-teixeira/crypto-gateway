const AUTH_TOKEN_COOKIE = "auth_token"
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function canUseBrowserStorage() {
  return typeof window !== "undefined"
}

function getCookieAttributes(maxAgeSeconds?: number) {
  const attributes = ["path=/", "SameSite=Lax"]

  if (typeof maxAgeSeconds === "number") {
    attributes.push(`max-age=${maxAgeSeconds}`)
  }

  if (canUseBrowserStorage() && window.location.protocol === "https:") {
    attributes.push("Secure")
  }

  return attributes.join("; ")
}

export function getAuthToken() {
  if (!canUseBrowserStorage()) return null

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${AUTH_TOKEN_COOKIE}=`))

  if (!cookie) return null

  return decodeURIComponent(cookie.slice(AUTH_TOKEN_COOKIE.length + 1))
}

export function setAuthToken(token: string, rememberMe: boolean) {
  if (!canUseBrowserStorage()) return

  const maxAge = rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : undefined
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(maxAge)}`
  clearLegacyAuthTokenStorage()
}

export function clearAuthSession() {
  if (!canUseBrowserStorage()) return

  document.cookie = `${AUTH_TOKEN_COOKIE}=; ${getCookieAttributes(0)}`
  clearLegacyAuthStorage()
}

export function clearLegacyAuthTokenStorage() {
  if (!canUseBrowserStorage()) return

  window.localStorage.removeItem("auth_token")
  window.sessionStorage.removeItem("auth_token")
}

export function clearLegacyAuthStorage() {
  if (!canUseBrowserStorage()) return

  clearLegacyAuthTokenStorage()
  window.localStorage.removeItem("auth_user")
  window.sessionStorage.removeItem("auth_user")
}
