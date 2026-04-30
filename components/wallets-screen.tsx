"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, RefreshCw, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TokenIcon, getTokenMeta } from "@/components/token-icon"
import { useSupportedTokens } from "@/hooks/use-supported-tokens"
import { apiUrl } from "@/lib/api-url"

type DepositWallet = {
  id: number
  address: string
  chain: string
  token: string
  token_balance: number | null
  native_balance: number | null
  active_payments: number
  created_at: number
}

type MainWallet = {
  id: number
  address: string
  type: "main"
  native_balances: Array<{ chain: string; native_balance: number | null }>
  created_at: number
}

type Withdrawal = {
  id: number
  source_wallet_id: number
  chain: string
  token: string
  amount: number
  destination_address: string
  status: string
  gas_tx_hash: string | null
  withdraw_tx_hash: string | null
  message: string | null
  created_at: number
  updated_at: number
}

const WALLETS_PER_PAGE = 10

function truncateAddress(address: string) {
  if (address.length <= 18) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

function nativeSymbol(chain: string) {
  switch (chain.toLowerCase()) {
    case "ronin":
      return "RON"
    case "ethereum":
      return "ETH"
    case "polygon":
      return "MATIC"
    case "bsc":
      return "BNB"
    case "avalanche":
      return "AVAX"
    default:
      return chain.toUpperCase()
  }
}

function formatAmount(value: number | null, digits = 6) {
  if (value === null) return "Erro ao carregar"
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })
}

function withdrawalStatusClasses(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-500/10 text-green-500 ring-green-500/20"
    case "failed":
      return "bg-red-500/10 text-red-500 ring-red-500/20"
    default:
      return "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20"
  }
}

function withdrawalStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pendente"
    case "checking":
      return "Verificando"
    case "funding_gas":
      return "Enviando gas"
    case "gas_sent":
      return "Gas enviado"
    case "withdrawing":
      return "Sacando"
    case "withdraw_tx_sent":
      return "Saque enviado"
    case "completed":
      return "Concluído"
    case "failed":
      return "Falhou"
    default:
      return status.replaceAll("_", " ")
  }
}

export function WalletsScreen() {
  const [mainWallet, setMainWallet] = useState<MainWallet | null>(null)
  const [wallets, setWallets] = useState<DepositWallet[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreatingWithdrawal, setIsCreatingWithdrawal] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [copiedAddress, setCopiedAddress] = useState("")
  const [withdrawWallet, setWithdrawWallet] = useState<DepositWallet | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawDestination, setWithdrawDestination] = useState("")
  const [walletPage, setWalletPage] = useState(1)
  const { getTokenSymbol } = useSupportedTokens()

  async function loadWallets() {
    const token = localStorage.getItem("auth_token") ?? sessionStorage.getItem("auth_token")
    if (!token) throw new Error("invalid-session")

    const response = await fetch(apiUrl("/wallets"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Erro ao carregar carteiras.")
    setMainWallet(data.main_wallet ?? null)
    setWallets(Array.isArray(data.wallets) ? data.wallets : [])

    const withdrawalResponse = await fetch(apiUrl("/withdrawals"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const withdrawalData = await withdrawalResponse.json()
    if (withdrawalResponse.ok) {
      setWithdrawals(Array.isArray(withdrawalData.withdrawals) ? withdrawalData.withdrawals : [])
    }
  }

  async function refreshWallets(spinner = false) {
    if (spinner) setIsRefreshing(true)
    else setIsLoading(true)
    setErrorMessage("")
    try {
      await loadWallets()
    } catch (error) {
      const msg = error instanceof Error ? error.message : ""
      setErrorMessage(msg === "invalid-session" ? "Sessão inválida. Faça login novamente." : "Não foi possível carregar as carteiras.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(""), 2000)
  }

  async function createWithdrawal() {
    const token = localStorage.getItem("auth_token") ?? sessionStorage.getItem("auth_token")
    if (!token || !withdrawWallet) return

    setIsCreatingWithdrawal(true)
    setErrorMessage("")
    try {
      const response = await fetch(apiUrl("/withdrawals"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_wallet_id: withdrawWallet.id,
          amount: Number(withdrawAmount),
          destination_address: withdrawDestination.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível criar o saque.")
        return
      }
      setWithdrawWallet(null)
      setWithdrawAmount("")
      setWithdrawDestination("")
      await refreshWallets(true)
    } finally {
      setIsCreatingWithdrawal(false)
    }
  }

  useEffect(() => {
    refreshWallets().catch(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeWallets = wallets.filter((wallet) => wallet.active_payments > 0).length
  const availableWallets = Math.max(0, wallets.length - activeWallets)
  const totalWalletPages = Math.max(1, Math.ceil(wallets.length / WALLETS_PER_PAGE))
  const visibleWallets = useMemo(() => {
    const start = (walletPage - 1) * WALLETS_PER_PAGE
    return wallets.slice(start, start + WALLETS_PER_PAGE)
  }, [walletPage, wallets])
  const firstVisibleWallet = wallets.length === 0 ? 0 : (walletPage - 1) * WALLETS_PER_PAGE + 1
  const lastVisibleWallet = Math.min(walletPage * WALLETS_PER_PAGE, wallets.length)

  useEffect(() => {
    setWalletPage((currentPage) => Math.min(currentPage, totalWalletPages))
  }, [totalWalletPages])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carteiras</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {wallets.length > 0
              ? `${wallets.length} depósito${wallets.length !== 1 ? "s" : ""} · ${availableWallets} livre${availableWallets !== 1 ? "s" : ""} · ${activeWallets} em uso`
              : "Main wallet e carteiras de depósito"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          disabled={isRefreshing}
          onClick={() => refreshWallets(true).catch(() => {})}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-500" role="alert">{errorMessage}</p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Main wallet</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-lg bg-secondary" />
          ) : !mainWallet ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Wallet className="h-9 w-9 opacity-25" />
              <p className="text-sm">Main wallet ainda não foi criada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <p className="font-semibold">EVM principal</p>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{mainWallet.address}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2"
                  onClick={() => copyAddress(mainWallet.address)}
                >
                  {copiedAddress === mainWallet.address ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedAddress === mainWallet.address ? "Copiado" : truncateAddress(mainWallet.address)}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {mainWallet.native_balances.map((balance) => (
                  <span key={balance.chain} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
                    <span className="capitalize text-muted-foreground">{balance.chain}</span>
                    <span className="font-semibold">{formatAmount(balance.native_balance, 8)} {nativeSymbol(balance.chain)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {withdrawWallet && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Sacar {getTokenMeta(withdrawWallet.token, getTokenSymbol(withdrawWallet.token)).symbol}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Origem</p>
              <p className="mt-1 font-mono text-xs text-foreground break-all">{withdrawWallet.address}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Valor</p>
                <input
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  inputMode="decimal"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Destino</p>
                <input
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30"
                  value={withdrawDestination}
                  onChange={(event) => setWithdrawDestination(event.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setWithdrawWallet(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isCreatingWithdrawal || !withdrawAmount || !withdrawDestination}
                onClick={() => createWithdrawal().catch(() => setIsCreatingWithdrawal(false))}
              >
                {isCreatingWithdrawal ? "Criando..." : "Criar saque"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base font-medium">Depósitos</CardTitle>
              {wallets.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Mostrando {firstVisibleWallet}-{lastVisibleWallet} de {wallets.length}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-14">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                <p className="text-sm text-muted-foreground">Carregando carteiras...</p>
              </div>
            ) : wallets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Wallet className="h-9 w-9 opacity-25" />
                <p className="text-sm">Nenhuma carteira criada ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleWallets.map((wallet) => {
                  const tokenSymbol = getTokenSymbol(wallet.token)
                  const tokenMeta = getTokenMeta(wallet.token, tokenSymbol)
                  const isActive = wallet.active_payments > 0

                  return (
                    <div key={wallet.id} className="px-4 py-3 transition-colors hover:bg-muted/30 sm:px-6">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <TokenIcon token={wallet.token} symbol={tokenSymbol} className="h-9 w-9 ring-2" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{tokenMeta.symbol}</p>
                              <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground capitalize">{wallet.chain}</span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
                              }`}>
                                {isActive ? "Em uso" : "Livre"}
                              </span>
                            </div>
                            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{wallet.address}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:min-w-[420px]">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Token</p>
                              <p className="font-semibold">{formatAmount(wallet.token_balance)} {tokenMeta.symbol}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Gas</p>
                              <p className="font-semibold">{formatAmount(wallet.native_balance, 8)} {nativeSymbol(wallet.chain)}</p>
                            </div>
                          </div>
                          <div className="flex justify-start gap-2 sm:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => copyAddress(wallet.address)}
                            >
                              {copiedAddress === wallet.address ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copiedAddress === wallet.address ? "Copiado" : truncateAddress(wallet.address)}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setWithdrawWallet(wallet)
                                setWithdrawAmount(String(wallet.token_balance ?? ""))
                                setWithdrawDestination("")
                              }}
                            >
                              Sacar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {wallets.length > WALLETS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 px-4 py-4 sm:justify-end sm:px-6">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={walletPage === 1}
                      aria-label="Página anterior"
                      onClick={() => setWalletPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-12 text-center text-xs font-medium text-muted-foreground">
                      {walletPage}/{totalWalletPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={walletPage === totalWalletPages}
                      aria-label="Próxima página"
                      onClick={() => setWalletPage((page) => Math.min(totalWalletPages, page + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-20 xl:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Saques</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {withdrawals.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhum saque solicitado.</p>
            ) : (
              <div className="divide-y divide-border">
                {withdrawals.slice(0, 8).map((withdrawal) => {
                  const tokenSymbol = getTokenSymbol(withdrawal.token)
                  const tokenMeta = getTokenMeta(withdrawal.token, tokenSymbol)
                  return (
                    <div key={withdrawal.id} className="px-4 py-3 sm:px-6">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {formatAmount(Number(withdrawal.amount))} {tokenMeta.symbol}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{withdrawal.chain}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${withdrawalStatusClasses(withdrawal.status)}`}>
                            {withdrawalStatusLabel(withdrawal.status)}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          {truncateAddress(withdrawal.destination_address)}
                        </p>
                        {withdrawal.status === "completed" && withdrawal.withdraw_tx_hash && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              tx: {truncateAddress(withdrawal.withdraw_tx_hash)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs"
                              onClick={() => copyAddress(withdrawal.withdraw_tx_hash!)}
                            >
                              {copiedAddress === withdrawal.withdraw_tx_hash ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {copiedAddress === withdrawal.withdraw_tx_hash ? "Copiado" : "Copiar"}
                            </Button>
                          </div>
                        )}
                        {withdrawal.message && (
                          <p className="text-xs text-muted-foreground">{withdrawal.message}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
