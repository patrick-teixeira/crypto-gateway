"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { CryptoDashboard } from "@/components/crypto-dashboard"
import { Button } from "@/components/ui/button"
import {
  clearAuthSession,
  clearLegacyAuthStorage,
  clearLegacyAuthTokenStorage,
  getAuthToken,
} from "@/lib/auth-session"

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
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<DashboardView>(initialView)

  useEffect(() => {
    const hasSession = Boolean(getAuthToken())

    if (!hasSession) {
      clearLegacyAuthStorage()
      setIsAuthenticated(false)
      setIsCheckingSession(false)
      return
    }

    clearLegacyAuthTokenStorage()
    setIsAuthenticated(true)
    setIsCheckingSession(false)
  }, [])

  useEffect(() => {
    setCurrentScreen(initialView)
  }, [initialView])

  function openScreen(screen: DashboardView) {
    setCurrentScreen(screen)
    router.push(VIEW_PATHS[screen])
  }

  function handleAuthSuccess() {
    setIsAuthenticated(true)
    setIsCheckingSession(false)
    setCurrentScreen(initialView)
  }

  function handleLogout() {
    clearAuthSession()
    setIsAuthenticated(false)
    setCurrentScreen("dashboard")
    router.replace("/home")
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
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
