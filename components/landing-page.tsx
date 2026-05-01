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
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl dark:border-primary/20">
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                      <Image
                        src="/icons/logo.png"
                        alt="CryptoGateway Dashboard"
                        fill
                        sizes="40px"
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Dashboard</p>
                      <p className="text-xs text-muted-foreground">Visão geral</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="rounded-xl bg-secondary/50 p-4">
                      <p className="text-xs text-muted-foreground">Saldo Total</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">$12,450.00</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Hoje</p>
                        <p className="mt-1 font-semibold text-foreground">$1,234</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Este mês</p>
                        <p className="mt-1 font-semibold text-foreground">$8,567</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/20" />
                            <div>
                              <p className="text-sm font-medium text-foreground">Pagamento #{i}</p>
                              <p className="text-xs text-muted-foreground">há 2 min</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-green-600">+$150</p>
                        </div>
                      ))}
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
