"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, Copy, Wallet, XCircle } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiUrl } from "@/lib/api-url"

type CheckoutPayment = {
  type?: "payment" | "selection"
  payment_id: number
  session_id?: number
  checkout_id: string
  address?: string
  amount: number
  token?: string
  chain?: string
  status: string
  created_at: number
  expires_at: number
  supported_chains?: Record<string, Record<string, string>>
  selected_payment_checkout_id?: string | null
}

function NetworkIcon({ chain }: { chain: string }) {
  const [iconIndex, setIconIndex] = useState(0)
  const normalized = chain.toLowerCase()
  const sources = [`/icons/${normalized}.png`, `/icons/${normalized}.svg`, `/icons/${normalized}.webp`]
  const src = sources[iconIndex]

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-muted-foreground ring-2 ring-border">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-full object-cover"
          onError={() => setIconIndex((current) => current + 1)}
        />
      ) : (
        chain.slice(0, 2)
      )}
    </span>
  )
}

const CHECKOUT_DURATION_SECONDS = 600
const STATUS_POLL_INTERVAL_MS = 10_000
const checkoutDarkThemeVars = {
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
  "--border": "oklch(0.25 0.005 247)",
  "--input": "oklch(0.2 0.005 247)",
  "--ring": "oklch(0.985 0.002 247)",
} as CSSProperties

function formatTimeLeft(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export default function CheckoutPage() {
  const params = useParams<{ paymentId: string }>()
  const paymentId = params?.paymentId

  const [payment, setPayment] = useState<CheckoutPayment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [selectedChain, setSelectedChain] = useState("")
  const [selectedToken, setSelectedToken] = useState("")
  const [supportedChains, setSupportedChains] = useState<Record<string, Record<string, string>>>({})
  const [isSelectingPayment, setIsSelectingPayment] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadCheckout = useCallback(
    async (isBackground = false) => {
      if (!paymentId) return
      if (!isBackground) { setIsLoading(true); setErrorMessage("") }
      try {
        const response = await fetch(apiUrl(`/checkout/${paymentId}`))
        const data = await response.json()
        if (!response.ok) {
          if (!isBackground) setErrorMessage(data.error ?? "Não foi possível carregar o checkout.")
          return
        }
        setPayment(data)
        if (data.supported_chains && typeof data.supported_chains === "object") {
          setSupportedChains(data.supported_chains)
        }
        setErrorMessage("")
      } catch {
        if (!isBackground) setErrorMessage("Erro de conexão com a API.")
      } finally {
        if (!isBackground) setIsLoading(false)
      }
    },
    [paymentId],
  )

  const paymentRef = useRef<CheckoutPayment | null>(null)
  paymentRef.current = payment

  useEffect(() => {
    loadCheckout(false).catch(() => {
      setErrorMessage("Não foi possível carregar o checkout.")
      setIsLoading(false)
    })
  }, [loadCheckout])

  useEffect(() => {
    if (Object.keys(supportedChains).length > 0) return

    fetch(apiUrl("/supported-chains"))
      .then((response) => response.json())
      .then((data) => {
        if (data && typeof data === "object") setSupportedChains(data)
      })
      .catch(() => {})
  }, [supportedChains])

  const remainingSeconds = useMemo(() => {
    if (!payment) return CHECKOUT_DURATION_SECONDS
    return Math.max(0, payment.expires_at - now)
  }, [payment, now])

  useEffect(() => {
    if (!payment) return
    const pollInterval = setInterval(() => {
      const current = paymentRef.current
      if (!current) return
      if (current.status === "paid") { clearInterval(pollInterval); return }
      if (Math.floor(Date.now() / 1000) >= current.expires_at) { clearInterval(pollInterval); return }
      loadCheckout(true).catch(() => {})
    }, STATUS_POLL_INTERVAL_MS)
    return () => clearInterval(pollInterval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCheckout, payment?.checkout_id])

  const progress = useMemo(() => Math.max(0, Math.min(100, (remainingSeconds / CHECKOUT_DURATION_SECONDS) * 100)), [remainingSeconds])

  const isSelection = payment?.type === "selection"
  const isPaid = payment?.status === "paid"
  const isExpired = remainingSeconds <= 0 && !isPaid
  const circleRadius = 52
  const circumference = 2 * Math.PI * circleRadius
  const strokeDashoffset = circumference * (1 - progress / 100)

  async function copyAddress() {
    if (!payment?.address) return
    await navigator.clipboard.writeText(payment.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function selectPaymentMethod() {
    if (!payment?.checkout_id || !selectedChain || !selectedToken) return
    if (payment.status === "paid" || remainingSeconds <= 0) return
    setIsSelectingPayment(true)
    setErrorMessage("")
    try {
      const response = await fetch(apiUrl(`/checkout/${payment.checkout_id}/select`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: selectedChain, token: selectedToken }),
      })
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível criar o pagamento.")
        return
      }
      window.location.href = `/checkout/${data.checkout_id}`
    } catch {
      setErrorMessage("Erro de conexão com a API.")
    } finally {
      setIsSelectingPayment(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6" style={checkoutDarkThemeVars}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="text-sm">Carregando checkout...</p>
        </div>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6" style={checkoutDarkThemeVars}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Checkout não encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (isPaid) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6" style={checkoutDarkThemeVars}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-4 ring-green-500/20">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">Pagamento confirmado!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Recebemos{" "}
                <span className="font-semibold text-foreground">
                  ${Number(payment!.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>{" "}
                com sucesso.
              </p>
            </div>
            <div className="w-full rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-left">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {isSelection ? "Checkout selecionado" : "ID do checkout"}
              </p>
              <p className="font-mono text-xs text-foreground break-all">
                {payment!.selected_payment_checkout_id ?? payment!.checkout_id}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (isExpired) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6" style={checkoutDarkThemeVars}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-4 ring-red-500/20">
              <Clock className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">Tempo esgotado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O prazo para este pagamento expirou. Gere um novo link de checkout.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (isSelection) {
    const availableChains = payment.supported_chains ?? supportedChains
    const tokenOptions = selectedChain ? Object.entries(availableChains[selectedChain] ?? {}) : []

    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6" style={checkoutDarkThemeVars}>
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Escolha como pagar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione a rede e a moeda para gerar o endereço de pagamento
            </p>
          </div>

          <Card>
            <CardContent className="space-y-5 py-6">
              <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                <p className="mt-1 text-3xl font-bold text-foreground">
                  ${Number(payment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rede</p>
                <Select
                  value={selectedChain}
                  onValueChange={(value) => {
                    setSelectedChain(value)
                    setSelectedToken("")
                  }}
                >
                  <SelectTrigger className="h-12 w-full rounded-lg border-border bg-background px-3">
                    <SelectValue placeholder="Selecione uma rede" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="w-[--radix-select-trigger-width] rounded-xl"
                    style={checkoutDarkThemeVars}
                  >
                  {Object.keys(availableChains).map((chain) => (
                      <SelectItem key={chain} value={chain} className="rounded-lg">
                        <span className="flex items-center gap-2">
                          <NetworkIcon chain={chain} />
                          <span className="font-medium capitalize">{chain}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Moeda</p>
                {selectedChain ? (
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger className="h-12 w-full rounded-lg border-border bg-background px-3">
                      <SelectValue placeholder="Selecione uma moeda" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="w-[--radix-select-trigger-width] rounded-xl"
                      style={checkoutDarkThemeVars}
                    >
                      {tokenOptions.map(([symbol, address]) => (
                        <SelectItem key={`${selectedChain}-${symbol}`} value={symbol} className="rounded-lg">
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="flex items-center gap-2">
                              <TokenIcon token={address} symbol={symbol} className="h-7 w-7 text-xs ring-2" />
                              <span className="font-semibold uppercase">{symbol}</span>
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {address.slice(0, 6)}...{address.slice(-4)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    Selecione uma rede primeiro
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                disabled={!selectedChain || !selectedToken || isSelectingPayment}
                onClick={() => selectPaymentMethod().catch(() => {})}
              >
                {isSelectingPayment ? "Gerando checkout..." : "Continuar"}
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            O endereço de depósito será gerado após a escolha da rede e moeda.
          </p>
        </div>
      </main>
    )
  }

  if (!payment?.address) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6" style={checkoutDarkThemeVars}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Checkout inválido</p>
              <p className="mt-1 text-sm text-muted-foreground">Não foi possível encontrar o endereço de pagamento.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const qrValue = payment.address
  const paymentTokenSymbol = Object.entries(payment.supported_chains ?? supportedChains)
    .flatMap(([, tokens]) => Object.entries(tokens))
    .find(([, address]) => address.trim().toLowerCase() === payment.token?.trim().toLowerCase())?.[0]?.toUpperCase()
    ?? "TOKEN"

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6" style={checkoutDarkThemeVars}>
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Finalize o pagamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escaneie o QR code ou copie o endereço abaixo
          </p>
        </div>

        {/* QR Code + valor + timer */}
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-6">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <QRCodeSVG value={qrValue} size={200} level="M" includeMargin={false} />
            </div>

            <div className="w-full space-y-1 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor a enviar</p>
              <p className="text-3xl font-bold text-foreground">
                ${Number(payment!.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/35 p-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Moeda</p>
                <div className="mt-2 flex items-center gap-2">
                  <TokenIcon token={payment.token} symbol={paymentTokenSymbol} className="h-7 w-7 text-xs ring-2" />
                  <span className="font-semibold">{paymentTokenSymbol}</span>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rede</p>
                <div className="mt-2 flex items-center gap-2">
                  <NetworkIcon chain={payment.chain ?? ""} />
                  <span className="font-semibold capitalize">{payment.chain}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={circleRadius} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r={circleRadius}
                    fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    className={progress < 25 ? "text-orange-500" : "text-blue-500"}
                    style={{ transition: "stroke-dashoffset 0.5s ease, color 0.5s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="font-mono text-sm font-bold leading-none">{formatTimeLeft(remainingSeconds)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Aguardando pagamento</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Verificando automaticamente...</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Carteira de destino</p>
            <p className="break-all font-mono text-sm text-foreground leading-relaxed">{payment!.address}</p>
            <Button variant="outline" className="w-full gap-2" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
              {copied ? "Copiado!" : "Copiar endereço"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Compatível com MetaMask, Trust Wallet, Ronin Wallet e outras wallets EVM
        </p>
      </div>
    </main>
  )
}
