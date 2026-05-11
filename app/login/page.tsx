"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { clearLegacyAuthStorage, clearLegacyAuthTokenStorage, getAuthToken } from "@/lib/auth-session"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const hasSession = Boolean(getAuthToken())

    if (hasSession) {
      clearLegacyAuthTokenStorage()
      router.replace("/home")
    } else {
      clearLegacyAuthStorage()
      const timeout = window.setTimeout(() => setIsLoading(false), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <LoginForm
      onAuthSuccess={() => {
        router.replace("/home")
      }}
    />
  )
}
