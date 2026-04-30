export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (configuredUrl) return configuredUrl.replace(/\/$/, "")

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8021`
  }

  return "http://localhost:8021"
}

export function apiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
}
