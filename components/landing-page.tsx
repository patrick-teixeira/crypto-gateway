"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Shield, Zap, Globe, Wallet, BarChart3, Lock, ChevronRight, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"

const features = [
  {
    icon: Zap,
    title: "Transações Instantâneas",
    description: "Receba pagamentos em segundos com confirmações rápidas em múltiplas blockchains.",
  },
  {
    icon: Shield,
    title: "Segurança Avançada",
    description: "Proteção de nível institucional para seus ativos digitais com criptografia de ponta.",
  },
  {
    icon: Globe,
    title: "Multi-chain",
    description: "Suporte para as principais redes como Ethereum, Polygon, BSC e muito mais.",
  },
]

const stats = [
  { value: "$50M+", label: "Volume Processado" },
  { value: "10k+", label: "Transações" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Suporte" },
]

const benefits = [
  {
    icon: Wallet,
    title: "Checkout Simplificado",
    description: "Integre pagamentos cripto em minutos com nossa API simples e documentação completa.",
  },
  {
    icon: BarChart3,
    title: "Analytics em Tempo Real",
    description: "Dashboard completo com métricas detalhadas sobre suas transações e receitas.",
  },
  {
    icon: Lock,
    title: "Conformidade Total",
    description: "Relatórios automáticos e ferramentas de compliance para facilitar sua contabilidade.",
  },
]

type PreviewTimeRange = "1S" | "1M" | "3M" | "1A" | "Todos"
type PreviewRevenuePoint = { label: string; value: number }

const previewRangeLabels: Record<PreviewTimeRange, string> = {
  "1S": "últimos 7 dias",
  "1M": "últimos 30 dias",
  "3M": "últimas 12 semanas",
  "1A": "últimos 12 meses",
  Todos: "todo o histórico",
}

const previewRevenueData: Record<PreviewTimeRange, PreviewRevenuePoint[]> = {
  "1S": [
    { label: "25/04", value: 10 },
    { label: "26/04", value: 20 },
    { label: "27/04", value: 15 },
    { label: "28/04", value: 35 },
    { label: "29/04", value: 25 },
    { label: "30/04", value: 50 },
    { label: "01/05", value: 30 },
  ],
  "1M": [
    { label: "02/04", value: 18 },
    { label: "06/04", value: 42 },
    { label: "10/04", value: 35 },
    { label: "14/04", value: 64 },
    { label: "18/04", value: 48 },
    { label: "22/04", value: 86 },
    { label: "26/04", value: 53 },
    { label: "01/05", value: 78 },
  ],
  "3M": [
    { label: "S1", value: 60 },
    { label: "S2", value: 95 },
    { label: "S3", value: 72 },
    { label: "S4", value: 130 },
    { label: "S5", value: 105 },
    { label: "S6", value: 152 },
    { label: "S7", value: 118 },
    { label: "S8", value: 174 },
    { label: "S9", value: 140 },
    { label: "S10", value: 190 },
    { label: "S11", value: 164 },
    { label: "S12", value: 210 },
  ],
  "1A": [
    { label: "jun", value: 26 },
    { label: "jul", value: 45 },
    { label: "ago", value: 65 },
    { label: "set", value: 80 },
    { label: "out", value: 52 },
    { label: "nov", value: 98 },
    { label: "dez", value: 130 },
    { label: "jan", value: 103 },
    { label: "fev", value: 152 },
    { label: "mar", value: 117 },
    { label: "abr", value: 80 },
    { label: "mai", value: 52 },
  ],
  Todos: [
    { label: "2024", value: 180 },
    { label: "2025", value: 420 },
    { label: "2026", value: 1000 },
  ],
}

function formatPreviewCurrency(value: number) {
  return `$${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
}

function buildPreviewChart(series: PreviewRevenuePoint[]) {
  const width = 220
  const height = 50
  const topPadding = 4
  const bottomPadding = 7
  const maxValue = Math.max(...series.map((point) => point.value), 1)
  const roundedMax = Math.ceil(maxValue / 50) * 50

  const points = series.map((point, index) => {
    const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width
    const y = topPadding + (1 - point.value / roundedMax) * (height - topPadding - bottomPadding)
    return { x, y }
  })

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`
  const peakPoint = points.reduce((peak, point) => (point.y < peak.y ? point : peak), points[0])
  const yAxisLabels = [roundedMax, roundedMax * 0.75, roundedMax * 0.5, roundedMax * 0.25, 0].map(Math.round)

  return { areaPath, linePath, peakPoint, yAxisLabels }
}

function PreviewTokenIcon({ token, size = "sm" }: { token: "USDC" | "USDT"; size?: "xs" | "sm" }) {
  const dimensionClass = size === "xs" ? "h-4 w-4" : "h-5 w-5"

  return (
    <span className={`relative flex shrink-0 overflow-hidden rounded-full ${dimensionClass}`}>
      <Image
        src={`/icons/${token.toLowerCase()}.png`}
        alt={token}
        fill
        sizes={size === "xs" ? "16px" : "20px"}
        className="object-contain"
      />
    </span>
  )
}

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [previewRange, setPreviewRange] = useState<PreviewTimeRange>("1A")
  const previewSeries = previewRevenueData[previewRange]
  const previewTotal = previewSeries.reduce((sum, point) => sum + point.value, 0)
  const previewChart = useMemo(() => buildPreviewChart(previewSeries), [previewSeries])

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-lg">
              <Image
                src="/icons/logo.png"
                alt="CryptoGateway"
                fill
                sizes="32px"
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg font-semibold text-foreground">CryptoGateway</span>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#benefits" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Benefícios
            </a>
            <a href="#stats" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Números
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label="Alternar tema"
            >
              {mounted ? (
                resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </Button>
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:inline-flex">
                Entrar
              </Button>
            </Link>
            <Link href="/login">
              <Button className="gap-2">
                Começar Agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.1),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.15),transparent)]" />
        <div className="absolute inset-0 -z-10 dark:bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,rgba(14,165,233,0.08),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Gateway de pagamentos cripto mais completo
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="text-balance">Pagamentos em Cripto para</span>
              <br />
              <span className="text-balance text-primary">Seu Negócio</span>
            </h1>
            
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Aceite pagamentos em criptomoedas de forma simples e segura. Dashboard completo, checkout personalizado e integração rápida com sua plataforma.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  Criar Conta Grátis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                  Conhecer Recursos
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="border-y border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-foreground sm:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Tudo que você precisa para aceitar cripto
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Recursos poderosos para escalar seu negócio com pagamentos em criptomoedas.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-lg dark:hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="border-t border-border bg-secondary/20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Simplifique seus pagamentos cripto
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Nossa plataforma oferece todas as ferramentas necessárias para gerenciar transações em criptomoedas de forma profissional.
              </p>

              <div className="mt-10 space-y-6">
                {benefits.map((benefit) => (
                  <div key={benefit.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <benefit.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{benefit.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#2dd4bf]/20 via-transparent to-[#2dd4bf]/20 opacity-0 blur-xl transition-opacity dark:opacity-75" />
              <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0a0a0a] p-4 shadow-xl dark:border-[#2dd4bf]/20">
                {/* Dashboard Preview - Matching Real Dashboard */}
                <div className="space-y-3">
                  {/* Top Section - Balance + Refresh */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-gray-500">Saldo Recebido Total</p>
                      <p className="text-2xl font-bold text-white">$1.000,00</p>
                    </div>
                    <button className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[9px] text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-300">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Atualizar
                    </button>
                  </div>

                  {/* Token Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 rounded-full border border-gray-700/50 bg-gray-900/50 px-2.5 py-1">
                      <PreviewTokenIcon token="USDC" size="xs" />
                      <span className="text-[9px] text-white">520,00 USDC</span>
                      <span className="text-[8px] text-gray-500">Ronin</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-gray-700/50 bg-gray-900/50 px-2.5 py-1">
                      <PreviewTokenIcon token="USDC" size="xs" />
                      <span className="text-[9px] text-white">280,00 USDC</span>
                      <span className="text-[8px] text-gray-500">Base</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-gray-700/50 bg-gray-900/50 px-2.5 py-1">
                      <PreviewTokenIcon token="USDT" size="xs" />
                      <span className="text-[9px] text-white">200,00 USDT</span>
                      <span className="text-[8px] text-gray-500">Bsc</span>
                    </div>
                  </div>

                  {/* Main Grid - Chart + Weekly */}
                  <div className="grid grid-cols-5 gap-2">
                    {/* Recebimentos Chart Card */}
                    <div className="col-span-3 rounded-xl border border-gray-800 bg-[#111111] p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-medium text-white">Recebimentos</p>
                          <p className="text-[8px] text-gray-500">
                            {previewRangeLabels[previewRange]} · {formatPreviewCurrency(previewTotal)}
                          </p>
                        </div>
                        <div className="flex gap-0.5 text-[7px]">
                          {(["1S", "1M", "3M", "1A", "Todos"] as PreviewTimeRange[]).map((range) => (
                            <button
                              key={range}
                              type="button"
                              onClick={() => setPreviewRange(range)}
                              className={`rounded px-1 py-0.5 ${
                                range === previewRange ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
                              }`}
                            >
                              {range}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Area Chart with months */}
                      <div className="relative h-20">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-[6px] text-gray-600">
                          {previewChart.yAxisLabels.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>
                        <div className="ml-5 h-full">
                          <svg className="h-full w-full" viewBox="0 0 220 50" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="previewChartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {/* Grid lines */}
                            <line x1="0" y1="12.5" x2="220" y2="12.5" stroke="#333" strokeWidth="0.5" strokeDasharray="2" />
                            <line x1="0" y1="25" x2="220" y2="25" stroke="#333" strokeWidth="0.5" strokeDasharray="2" />
                            <line x1="0" y1="37.5" x2="220" y2="37.5" stroke="#333" strokeWidth="0.5" strokeDasharray="2" />
                            {/* Area fill - smooth curve with distributed values */}
                            <path
                              d={previewChart.areaPath}
                              fill="url(#previewChartGradient)"
                            />
                            {/* Line */}
                            <path
                              d={previewChart.linePath}
                              fill="none"
                              stroke="#2dd4bf"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {/* Dot on peak */}
                            <circle cx={previewChart.peakPoint.x} cy={previewChart.peakPoint.y} r="2" fill="#2dd4bf" />
                          </svg>
                        </div>
                        {/* X-axis months */}
                        <div className="ml-5 mt-1 flex justify-between text-[5px] text-gray-600">
                          {previewSeries.map((point) => (
                            <span key={point.label}>{point.label}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Últimos 7 dias Card */}
                    <div className="col-span-2 rounded-xl border border-gray-800 bg-[#111111] p-3">
                      <p className="text-[10px] font-medium text-white">Últimos 7 dias</p>
                      <p className="text-lg font-bold text-white">$185,00</p>
                      <p className="text-[7px] text-gray-500">Total recebido na semana</p>
                      {/* Bar chart - 7 days */}
                      <div className="mt-2 flex h-12 items-end justify-between gap-0.5">
                        {[
                          { h: 3, date: "25/04" },
                          { h: 6, date: "26/04" },
                          { h: 4, date: "27/04" },
                          { h: 8, date: "28/04" },
                          { h: 5, date: "29/04" },
                          { h: 10, date: "30/04" },
                          { h: 7, date: "01/05" },
                        ].map((bar, i) => (
                          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                            <div 
                              className={`w-full rounded-sm ${bar.h > 7 ? "bg-[#2dd4bf]" : "bg-[#2dd4bf]/60"}`}
                              style={{ height: `${bar.h * 3.5}px` }}
                            />
                            <span className="text-[4px] text-gray-600">{bar.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Grid - Assets + Transactions */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Meus Ativos Card */}
                    <div className="rounded-xl border border-gray-800 bg-[#111111] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-medium text-white">Meus Ativos</p>
                        <span className="flex items-center gap-0.5 text-[8px] text-gray-500">Ver todos <ChevronRight className="h-2 w-2" /></span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { token: "USDC", network: "Ronin", address: "0x0b7007...808adc", amount: "520,00" },
                          { token: "USDC", network: "Base", address: "0x833589...A02913", amount: "280,00" },
                          { token: "USDT", network: "Bsc", address: "0x55d398...7d44f5", amount: "200,00" },
                        ].map((asset, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PreviewTokenIcon token={asset.token as "USDC" | "USDT"} />
                              <div>
                                <p className="text-[9px] font-medium text-white">{asset.token}</p>
                                <p className="text-[7px] text-gray-500">{asset.network} · {asset.address}</p>
                              </div>
                            </div>
                            <p className="text-[9px] text-white">{asset.amount}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Transações Recentes Card */}
                    <div className="rounded-xl border border-gray-800 bg-[#111111] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-medium text-white">Transacoes Recentes</p>
                        <span className="text-[10px] text-gray-500">...</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { token: "USDC", amount: "+45,00", time: "01/05, 14:32", network: "Ronin" },
                          { token: "USDT", amount: "+120,00", time: "30/04, 11:45", network: "Bsc" },
                          { token: "USDC", amount: "+85,00", time: "29/04, 09:20", network: "Base" },
                        ].map((tx, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PreviewTokenIcon token={tx.token as "USDC" | "USDT"} />
                              <div>
                                <p className="text-[9px] font-medium text-white">Recebido · {tx.token}</p>
                                <p className="text-[7px] text-gray-500">{tx.network} · {tx.time}</p>
                              </div>
                            </div>
                            <p className="text-[9px] font-medium text-[#2dd4bf]">{tx.amount}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center sm:px-16 sm:py-24 dark:shadow-[0_0_60px_-15px] dark:shadow-primary/30">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl text-balance">
              Pronto para aceitar pagamentos em cripto?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
              Comece gratuitamente e escale conforme seu negócio cresce. Sem taxas ocultas.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="w-full gap-2 sm:w-auto">
                  Criar Conta Grátis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6 overflow-hidden rounded-md">
                <Image
                  src="/icons/logo.png"
                  alt="CryptoGateway"
                  fill
                  sizes="24px"
                  className="object-contain"
                />
              </div>
              <span className="text-sm font-semibold text-foreground">CryptoGateway</span>
            </div>
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Termos de Uso
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Privacidade
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Contato
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              © 2026 CryptoGateway. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
