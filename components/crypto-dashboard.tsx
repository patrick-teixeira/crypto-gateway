"use client"

import { type CSSProperties, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowDownRight,
  Bell,
  ChevronDown,
  Home,
  MoreHorizontal,
  Search,
  Settings,
  Wallet,
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react"
import { Area, AreaChart, XAxis, YAxis, Bar, BarChart, CartesianGrid } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { SettingsScreen } from "@/components/settings-screen"
import { TransactionsScreen } from "@/components/transactions-screen"
import { WalletsScreen } from "@/components/wallets-screen"
import { TokenIcon, getTokenMeta } from "@/components/token-icon"
import { useSupportedTokens } from "@/hooks/use-supported-tokens"
import { apiUrl } from "@/lib/api-url"
import { getAuthToken } from "@/lib/auth-session"

const EMPTY_SERIES = [{ date: "Sem dados", value: 0 }]

type TimeRange = "1S" | "1M" | "3M" | "1A" | "Todos"

const RANGE_LABELS: Record<TimeRange, string> = {
  "1S": "últimos 7 dias",
  "1M": "últimos 30 dias",
  "3M": "últimas 12 semanas",
  "1A": "últimos 12 meses",
  Todos: "todo o histórico",
}

function isTimeRange(value: string): value is TimeRange {
  return value === "1S" || value === "1M" || value === "3M" || value === "1A" || value === "Todos"
}

const chartConfig = {
  value: { label: "Recebido", color: "var(--chart-1)" },
  total: { label: "Volume", color: "var(--chart-2)" },
}

const dashboardDarkThemeVars = {
  "--background": "oklch(0.1 0.005 247)",
  "--foreground": "oklch(0.985 0.002 247)",
  "--card": "oklch(0.145 0.005 247)",
  "--card-foreground": "oklch(0.985 0.002 247)",
  "--popover": "oklch(0.145 0.005 247)",
  "--popover-foreground": "oklch(0.985 0.002 247)",
  "--primary": "oklch(0.985 0.002 247)",
  "--primary-foreground": "oklch(0.1 0.005 247)",
  "--secondary": "oklch(0.2 0.005 247)",
  "--secondary-foreground": "oklch(0.985 0.002 247)",
  "--muted": "oklch(0.2 0.005 247)",
  "--muted-foreground": "oklch(0.65 0.005 247)",
  "--accent": "oklch(0.2 0.005 247)",
  "--accent-foreground": "oklch(0.985 0.002 247)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--border": "oklch(0.25 0.005 247)",
  "--input": "oklch(0.2 0.005 247)",
  "--ring": "oklch(0.985 0.002 247)",
  "--chart-1": "oklch(0.7 0.15 200)",
  "--chart-2": "oklch(0.6 0.12 180)",
  "--chart-3": "oklch(0.5 0.1 160)",
  "--chart-4": "oklch(0.4 0.08 140)",
  "--chart-5": "oklch(0.3 0.06 120)",
  "--sidebar": "oklch(0.145 0.005 247)",
  "--sidebar-foreground": "oklch(0.985 0.002 247)",
  "--sidebar-primary": "oklch(0.985 0.002 247)",
  "--sidebar-primary-foreground": "oklch(0.1 0.005 247)",
  "--sidebar-accent": "oklch(0.2 0.005 247)",
  "--sidebar-accent-foreground": "oklch(0.985 0.002 247)",
  "--sidebar-border": "oklch(0.25 0.005 247)",
  "--sidebar-ring": "oklch(0.985 0.002 247)",
} as CSSProperties

type Balance = { token: string; chain: string; amount: number }
type Payment = { id: number; amount: number; chain: string; token: string; status: string; created_at: number }
type RecentPayment = Omit<Payment, "status">
type AnalyticsPoint = { date: string; value: number }
type DailyPoint = { day: string; total: number }
type Notification = {
  id: number
  type: string
  entity_id: number
  title: string
  message: string
  status: string
  created_at: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
}

function addAmount(bucket: Map<string, AnalyticsPoint>, key: string, label: string, amount: number) {
  const current = bucket.get(key)
  bucket.set(key, {
    date: current?.date ?? label,
    value: (current?.value ?? 0) + amount,
  })
}

function buildRevenueSeries(payments: Payment[], range: TimeRange): AnalyticsPoint[] {
  const paidPayments = payments
    .filter((payment) => payment.status === "paid")
    .sort((a, b) => a.created_at - b.created_at)

  if (paidPayments.length === 0) return EMPTY_SERIES

  const now = startOfDay(new Date())
  const firstPaymentDate = startOfDay(new Date(paidPayments[0].created_at * 1000))
  const bucket = new Map<string, AnalyticsPoint>()

  if (range === "1S" || range === "1M") {
    const days = range === "1S" ? 7 : 30
    const start = new Date(now)
    start.setDate(start.getDate() - (days - 1))

    for (let i = 0; i < days; i += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const key = date.toISOString().slice(0, 10)
      bucket.set(key, { date: formatDayLabel(date), value: 0 })
    }

    for (const payment of paidPayments) {
      const date = startOfDay(new Date(payment.created_at * 1000))
      if (date < start || date > now) continue
      addAmount(bucket, date.toISOString().slice(0, 10), formatDayLabel(date), Number(payment.amount))
    }

    return Array.from(bucket.values())
  }

  if (range === "3M") {
    const start = new Date(now)
    start.setDate(start.getDate() - 89)

    for (const payment of paidPayments) {
      const date = startOfDay(new Date(payment.created_at * 1000))
      if (date < start || date > now) continue
      const diffDays = Math.floor((date.getTime() - start.getTime()) / DAY_MS)
      const weekIndex = Math.floor(diffDays / 7) + 1
      const key = String(weekIndex).padStart(2, "0")
      addAmount(bucket, key, `S${weekIndex}`, Number(payment.amount))
    }

    return bucket.size > 0 ? Array.from(bucket.values()) : EMPTY_SERIES
  }

  const start = range === "1A"
    ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
    : new Date(firstPaymentDate.getFullYear(), firstPaymentDate.getMonth(), 1)
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1

  for (let i = 0; i < months; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    bucket.set(key, { date: formatMonthLabel(date), value: 0 })
  }

  for (const payment of paidPayments) {
    const date = new Date(payment.created_at * 1000)
    if (date < start) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    addAmount(bucket, key, formatMonthLabel(date), Number(payment.amount))
  }

  return Array.from(bucket.values())
}

interface CryptoDashboardProps {
  onOpenSettings?: () => void
  onOpenDashboard?: () => void
  onOpenWallets?: () => void
  onOpenTransactions?: () => void
  currentView?: "dashboard" | "wallets" | "settings" | "transactions"
}

export function CryptoDashboard({
  onOpenSettings,
  onOpenDashboard,
  onOpenWallets,
  onOpenTransactions,
  currentView = "dashboard",
}: CryptoDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1A")
  const [balances, setBalances] = useState<Balance[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [recentPaid, setRecentPaid] = useState<RecentPayment[]>([])
  const [isLoadingBalances, setIsLoadingBalances] = useState(true)
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false)
  const [dailyData, setDailyData] = useState<DailyPoint[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const { getTokenSymbol } = useSupportedTokens()

  async function fetchNotifications(token: string) {
    const response = await fetch(apiUrl("/notifications"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return
    const data = await response.json()
    setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
    setUnreadNotifications(Number(data.unread_count ?? 0))
  }

  async function markNotificationsAsRead() {
    const token = getAuthToken()
    if (!token || unreadNotifications === 0) return
    await fetch(apiUrl("/notifications/read"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })
    setUnreadNotifications(0)
    setNotifications((current) => current.map((notification) => ({ ...notification, status: "read" })))
  }

  async function fetchData(refresh = false, range = timeRange) {
    const token = getAuthToken()
    if (!token) { setIsLoadingBalances(false); return }
    if (refresh) setIsRefreshingBalances(true)
    try {
      const [balRes, analyticsRes, paymentsRes] = await Promise.all([
        fetch(apiUrl("/balance"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl(`/analytics?range=${encodeURIComponent(range)}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/payments"), { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (balRes.ok) {
        const data = await balRes.json()
        setBalances(Array.isArray(data.balances) ? data.balances : [])
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        if (Array.isArray(data.daily)) {
          setDailyData(data.daily)
        }
      }
      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
        const allPayments = Array.isArray(data.payments) ? data.payments : []
        const paid = allPayments
          .filter((p: Payment) => p.status === "paid")
          .slice(0, 5)
        setPayments(allPayments)
        setRecentPaid(paid)
      }
      await fetchNotifications(token)
    } finally {
      setIsLoadingBalances(false)
      setIsRefreshingBalances(false)
    }
  }

  useEffect(() => {
    fetchData().catch(() => setIsLoadingBalances(false))

    // Auto-refresh every 30s so balance updates after payment validation
    const interval = setInterval(() => {
      fetchData(true).catch(() => {})
    }, 30_000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange])

  const totalBalance = balances.reduce((acc, b) => acc + Number(b.amount), 0)
  const revenueData = useMemo(() => buildRevenueSeries(payments, timeRange), [payments, timeRange])
  const periodReceived = revenueData.reduce((acc, point) => acc + Number(point.value), 0)

  return (
    <div className="flex min-h-screen bg-background" style={dashboardDarkThemeVars}>
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-sidebar p-4 lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-sidebar-accent">
            <Image
              src="/icons/logo.png"
              alt="CryptoGateway"
              fill
              sizes="32px"
              className="object-contain"
              priority
            />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">CryptoGateway</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <NavItem icon={Home} label="Dashboard" active={currentView === "dashboard"} onClick={onOpenDashboard} />
          <NavItem icon={Wallet} label="Carteira" active={currentView === "wallets"} onClick={onOpenWallets} />
          <NavItem icon={ArrowRightLeft} label="Transacoes" active={currentView === "transactions"} onClick={onOpenTransactions} />
          <NavItem icon={Settings} label="Configuracoes" active={currentView === "settings"} onClick={onOpenSettings} />
        </nav>
        <div className="mt-auto rounded-xl bg-sidebar-accent p-4">
          <p className="mt-1 text-xs text-muted-foreground">Acesse recursos avancados e analises em tempo real.</p>
          <Button size="sm" className="mt-3 w-full">Upgrade</Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar ativos..." className="w-64 bg-secondary pl-9" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu onOpenChange={(open) => {
              if (open) markNotificationsAsRead().catch(() => {})
            }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notificações</span>
                  {notifications.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{notifications.length}</span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma notificação ainda.
                  </div>
                ) : (
                  notifications.slice(0, 8).map((notification) => (
                    <DropdownMenuItem key={notification.id} className="items-start gap-3 whitespace-normal">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.type === "withdrawal_failed"
                          ? "bg-red-500"
                          : "bg-green-500"
                      }`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{notification.title}</span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                          {new Date(notification.created_at * 1000).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Perfil</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenSettings}>Configuracoes</DropdownMenuItem>
                <DropdownMenuItem>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-4 sm:p-6">
          {currentView === "settings" ? (
            <SettingsScreen />
          ) : currentView === "wallets" ? (
            <WalletsScreen />
          ) : currentView === "transactions" ? (
            <TransactionsScreen />
          ) : (
            <>
              {/* Real Balance Section */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Recebido Total</p>
                    {isLoadingBalances ? (
                      <div className="mt-2 h-9 w-48 animate-pulse rounded-lg bg-secondary" />
                    ) : (
                      <h1 className="mt-1 text-4xl font-bold tracking-tight">
                        ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        
                      </h1>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0 mt-1"
                    disabled={isRefreshingBalances}
                    onClick={() => fetchData(true).catch(() => {})}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingBalances ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>

                {/* Per-token balance pills */}
                {!isLoadingBalances && balances.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {balances.map((b) => (
                      <div key={`${b.token}-${b.chain}`} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5">
                        <TokenIcon token={b.token} symbol={getTokenSymbol(b.token)} className="h-5 w-5 text-[10px] ring-2" />
                        <span className="text-xs font-semibold text-foreground">
                          {Number(b.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-medium text-foreground">{getTokenMeta(b.token, getTokenSymbol(b.token)).symbol}</span>
                        <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground capitalize">{b.chain}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoadingBalances && balances.length === 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum saldo ainda. Saldos são atualizados ao receber pagamentos.</p>
                )}
              </div>

              {/* Charts Grid */}
              <div className="mb-8 grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base font-medium">Recebimentos</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {RANGE_LABELS[timeRange]} · {periodReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <Tabs value={timeRange} onValueChange={(value) => {
                      if (isTimeRange(value)) setTimeRange(value)
                    }}>
                      <TabsList className="h-8">
                        <TabsTrigger value="1S" className="px-2 text-xs">1S</TabsTrigger>
                        <TabsTrigger value="1M" className="px-2 text-xs">1M</TabsTrigger>
                        <TabsTrigger value="3M" className="px-2 text-xs">3M</TabsTrigger>
                        <TabsTrigger value="1A" className="px-2 text-xs">1A</TabsTrigger>
                        <TabsTrigger value="Todos" className="px-2 text-xs">Todos</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ChartContainer config={chartConfig} className="h-[280px] w-full">
                      <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v) => v === 0 ? "0" : `${v}`} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => (
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            />
                          }
                        />
                        <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2.5} fill="transparent" />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Últimos 7 dias</CardTitle>
                    <p className="text-2xl font-bold">
                      {dailyData.reduce((s, d) => s + Number(d.total), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Total recebido na semana</p>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                      <BarChart data={dailyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Assets and Transactions */}
              <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-base font-medium">Meus Ativos</CardTitle>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      Ver todos
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {balances.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo ainda.</p>
                      ) : (
                        balances.map((b) => (
                          <div key={`${b.token}-${b.chain}`} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary">
                            <div className="flex items-center gap-3">
                              <TokenIcon token={b.token} symbol={getTokenSymbol(b.token)} />
                              <div>
                                <p className="font-medium">{getTokenMeta(b.token, getTokenSymbol(b.token)).symbol}</p>
                                <p className="font-mono text-xs text-muted-foreground">
                                  <span className="capitalize">{b.chain}</span>
                                  <span className="mx-1">·</span>
                                  {b.token.length > 14 ? `${b.token.slice(0, 8)}…${b.token.slice(-6)}` : b.token}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {Number(b.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-base font-medium">Transacoes Recentes</CardTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentPaid.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pagamento confirmado.</p>
                      ) : (
                        recentPaid.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <TokenIcon token={tx.token} symbol={getTokenSymbol(tx.token)} className="h-9 w-9 ring-2" />
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white ring-2 ring-card">
                                  <ArrowDownRight className="h-2.5 w-2.5" />
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  Recebido · {getTokenMeta(tx.token, getTokenSymbol(tx.token)).symbol}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  <span className="capitalize">{tx.chain}</span>
                                  <span className="mx-1">·</span>
                                  {new Date(tx.created_at * 1000).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-success">
                              +{Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {getTokenMeta(tx.token, getTokenSymbol(tx.token)).symbol}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <MobileNavItem icon={Home} label="Dashboard" active={currentView === "dashboard"} onClick={onOpenDashboard} />
          <MobileNavItem icon={Wallet} label="Carteira" active={currentView === "wallets"} onClick={onOpenWallets} />
          <MobileNavItem icon={ArrowRightLeft} label="Transacoes" active={currentView === "transactions"} onClick={onOpenTransactions} />
          <MobileNavItem icon={Settings} label="Ajustes" active={currentView === "settings"} onClick={onOpenSettings} />
        </div>
      </nav>
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function MobileNavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="w-full truncate text-center">{label}</span>
    </button>
  )
}
