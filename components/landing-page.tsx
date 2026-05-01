"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Shield, Zap, Globe, Wallet, BarChart3, Lock, ChevronRight, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

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

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

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
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-0 blur-xl transition-opacity dark:opacity-75" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl dark:border-primary/20">
                {/* Dashboard Preview - Simulated UI */}
                <div className="flex h-[420px]">
                  {/* Mini Sidebar */}
                  <div className="hidden w-14 flex-col border-r border-border bg-secondary/30 p-2 sm:flex">
                    <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <div className="relative h-5 w-5 overflow-hidden rounded">
                        <Image
                          src="/icons/logo.png"
                          alt="Logo"
                          fill
                          sizes="20px"
                          className="object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <div className="h-3.5 w-3.5 rounded-sm bg-current opacity-80" />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50">
                        <Wallet className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 overflow-hidden">
                    {/* Mini Header */}
                    <div className="flex items-center justify-between border-b border-border bg-background/50 px-4 py-2">
                      <div className="flex h-6 w-28 items-center rounded-md bg-secondary/50 px-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                        <span className="ml-1.5 text-[9px] text-muted-foreground">Buscar...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-secondary/50" />
                        <div className="h-5 w-5 rounded-full bg-secondary/50" />
                      </div>
                    </div>

                    {/* Dashboard Content */}
                    <div className="p-4">
                      {/* Balance Section */}
                      <div className="mb-4">
                        <p className="text-[10px] text-muted-foreground">Saldo Recebido Total</p>
                        <p className="text-xl font-bold text-foreground">$12,450.00</p>
                        
                        {/* Token Pills */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5">
                            <div className="h-3.5 w-3.5 rounded-full bg-[#627eea]" />
                            <span className="text-[9px] font-medium text-foreground">5,230.00 ETH</span>
                          </div>
                          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5">
                            <div className="h-3.5 w-3.5 rounded-full bg-[#26a17b]" />
                            <span className="text-[9px] font-medium text-foreground">4,120.00 USDT</span>
                          </div>
                          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5">
                            <div className="h-3.5 w-3.5 rounded-full bg-[#2775ca]" />
                            <span className="text-[9px] font-medium text-foreground">3,100.00 USDC</span>
                          </div>
                        </div>
                      </div>

                      {/* Chart Card */}
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-medium text-foreground">Recebimentos</p>
                            <p className="text-[8px] text-muted-foreground">últimos 12 meses</p>
                          </div>
                          <div className="flex gap-0.5 rounded-md bg-secondary/50 p-0.5">
                            {["1S", "1M", "1A"].map((t, i) => (
                              <span
                                key={t}
                                className={`rounded px-1.5 py-0.5 text-[8px] ${
                                  i === 2 ? "bg-background text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* Simulated Area Chart */}
                        <div className="relative h-24">
                          <svg className="h-full w-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" className="[stop-color:var(--chart-1)]" stopOpacity="0.3" />
                                <stop offset="100%" className="[stop-color:var(--chart-1)]" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M0,45 Q20,40 40,35 T80,25 T120,30 T160,15 T200,20 L200,60 L0,60 Z"
                              fill="url(#chartGradient)"
                            />
                            <path
                              d="M0,45 Q20,40 40,35 T80,25 T120,30 T160,15 T200,20"
                              fill="none"
                              className="stroke-primary"
                              strokeWidth="2"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Recent Payments */}
                      <div className="mt-3">
                        <p className="mb-2 text-[10px] font-medium text-foreground">Pagamentos Recentes</p>
                        <div className="space-y-1.5">
                          {[
                            { token: "ETH", amount: "0.25", usd: "450.00", time: "2 min" },
                            { token: "USDT", amount: "150.00", usd: "150.00", time: "15 min" },
                            { token: "USDC", amount: "320.00", usd: "320.00", time: "1h" },
                          ].map((payment, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/30 px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <div className={`h-5 w-5 rounded-full ${
                                  payment.token === "ETH" ? "bg-[#627eea]" :
                                  payment.token === "USDT" ? "bg-[#26a17b]" : "bg-[#2775ca]"
                                }`} />
                                <div>
                                  <p className="text-[9px] font-medium text-foreground">{payment.amount} {payment.token}</p>
                                  <p className="text-[8px] text-muted-foreground">há {payment.time}</p>
                                </div>
                              </div>
                              <p className="text-[9px] font-semibold text-green-500">+${payment.usd}</p>
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
