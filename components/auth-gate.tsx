"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { CryptoDashboard } from "@/components/crypto-dashboard"
import { Button } from "@/components/ui/button"

export type DashboardView = "dashboard" | "wallets" | "settings" | "transactions"

const VIEW_PATHS: Record<DashboardView, string> = {
  dashboard: "/home",
  wallets: "/wallet",
  settings: "/settings",
  transactions: "/transactions",
}

interface AuthGateProps {
  initialView?: DashboardView
}

export function AuthGate({ initialView = "dashboard" }: AuthGateProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    const localToken = window.localStorage.getItem("auth_token")
    const sessionToken = window.sessionStorage.getItem("auth_token")
    const localUser = window.localStorage.getItem("auth_user")
    const sessionUser = window.sessionStorage.getItem("auth_user")
    const hasSession = Boolean(localToken || sessionToken) && Boolean(localUser || sessionUser)

    if (!hasSession) {
      window.localStorage.removeItem("auth_token")
      window.localStorage.removeItem("auth_user")
      window.sessionStorage.removeItem("auth_token")
      window.sessionStorage.removeItem("auth_user")
      return false
    }

    return true
  })
  const [currentScreen, setCurrentScreen] = useState<DashboardView>(initialView)

  useEffect(() => {
    setCurrentScreen(initialView)
  }, [initialView])

  function openScreen(screen: DashboardView) {
    setCurrentScreen(screen)
    router.push(VIEW_PATHS[screen])
  }

  function handleAuthSuccess() {
    setIsAuthenticated(true)
    setCurrentScreen(initialView)
  }

  function handleLogout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    sessionStorage.removeItem("auth_token")
    sessionStorage.removeItem("auth_user")
    setIsAuthenticated(false)
    setCurrentScreen("dashboard")
    router.replace("/home")
  }

  if (!isAuthenticated) {
    return <LoginForm onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-50">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </div>
      <CryptoDashboard
        currentView={currentScreen}
        onOpenDashboard={() => openScreen("dashboard")}
        onOpenWallets={() => openScreen("wallets")}
        onOpenSettings={() => openScreen("settings")}
        onOpenTransactions={() => openScreen("transactions")}
      />
    </div>
  )
}
