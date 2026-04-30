"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, ReceiptText } from "lucide-react"
import { TokenIcon, getTokenMeta } from "@/components/token-icon"
import { useSupportedTokens } from "@/hooks/use-supported-tokens"
import { apiUrl } from "@/lib/api-url"

type Payment = {
  id: number
  address: string
  amount: number
  chain: string | null
  token: string | null
  status: string
  created_at: number
  webhook_url: string | null
  message: string | null
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function truncateAddress(address: string) {
  if (address.length <= 16) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

type StatusConfig = { label: string; classes: string; dot: string }

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "paid":
      return { label: "Pago", classes: "bg-green-500/10 text-green-500 ring-green-500/20", dot: "bg-green-500" }
    case "waiting-payment":
      return { label: "Aguardando", classes: "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20", dot: "bg-yellow-400 animate-pulse" }
    case "expired":
      return { label: "Expirado", classes: "bg-red-500/10 text-red-500 ring-red-500/20", dot: "bg-red-500" }
    default:
      return { label: status, classes: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20", dot: "bg-zinc-500" }
  }
}

export function TransactionsScreen() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const { getTokenSymbol } = useSupportedTokens()

  async function loadPayments() {
    const token = localStorage.getItem("auth_token") ?? sessionStorage.getItem("auth_token")
    if (!token) throw new Error("invalid-session")

    const response = await fetch(apiUrl("/payments"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Erro ao carregar transações.")
    setPayments(Array.isArray(data.payments) ? data.payments : [])
  }

  async function refreshPayments(spinner = false) {
    if (spinner) setIsRefreshing(true)
    else setIsLoading(true)
    setErrorMessage("")
    try {
      await loadPayments()
    } catch (error) {
      const msg = error instanceof Error ? error.message : ""
      setErrorMessage(msg === "invalid-session" ? "Sessão inválida. Faça login novamente." : "Não foi possível carregar as transações.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => refreshPayments().catch(() => setIsLoading(false)), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {payments.length > 0 ? `${payments.length} pagamento${payments.length !== 1 ? "s" : ""}` : "Histórico de pagamentos"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={isRefreshing}
          onClick={() => refreshPayments(true).catch(() => {})}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-500" role="alert">{errorMessage}</p>
      )}

      <Card>
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <ReceiptText className="h-9 w-9 opacity-25" />
              <p className="text-sm">Nenhuma transação encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hidden md:table-cell">Rede</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => {
                    const s = getStatusConfig(payment.status)
                    const tokenSymbol = getTokenSymbol(payment.token)
                    return (
                      <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <TokenIcon token={payment.token} symbol={tokenSymbol} className="h-7 w-7 text-xs ring-2" />
                            <div>
                              <p className="font-semibold">
                                {Number(payment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {getTokenMeta(payment.token, tokenSymbol).symbol}
                              </p>
                              {payment.token && payment.token.startsWith("0x") && (
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  {truncateAddress(payment.token)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {formatDate(payment.created_at)}
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          {payment.chain ? (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
                              {payment.chain}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.classes}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


