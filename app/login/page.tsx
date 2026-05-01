"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if already authenticated
    const localToken = localStorage.getItem("auth_token")
    const sessionToken = sessionStorage.getItem("auth_token")
    const localUser = localStorage.getItem("auth_user")
    const sessionUser = sessionStorage.getItem("auth_user")
    const hasSession = Boolean(localToken || sessionToken) && Boolean(localUser || sessionUser)

    if (hasSession) {
      router.replace("/home")
    } else {
      setIsLoading(false)
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
