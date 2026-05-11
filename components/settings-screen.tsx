"use client"

import { useEffect, useState } from "react"
import { Copy, KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiUrl, getApiBaseUrl } from "@/lib/api-url"
import { getAuthToken } from "@/lib/auth-session"

export function SettingsScreen() {
  const [apiKeys, setApiKeys] = useState<Array<{ id: number; name: string; api_key: string; created_at: number }>>([])
  const [apiKey, setApiKey] = useState("")
  const [copied, setCopied] = useState(false)
  const [apiKeyName, setApiKeyName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  async function loadApiKeys() {
    const token = getAuthToken()
    if (!token) {
      setErrorMessage("Sessão inválida. Faça login novamente.")
      return
    }

    const response = await fetch(apiUrl("/auth/api-keys/list"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      setErrorMessage(data.error ?? "Não foi possível carregar as API keys.")
      return
    }
    const list = Array.isArray(data.api_keys) ? data.api_keys : []
    setApiKeys(list)
    setApiKey(list[0]?.api_key ?? "")
  }

  useEffect(() => {
    loadApiKeys().catch(() => {
      setErrorMessage("Não foi possível carregar as API keys.")
    })
  }, [])

  async function handleGenerateApiKey() {
    setErrorMessage("")
    setSuccessMessage("")

    if (!apiKeyName.trim()) {
      setErrorMessage("Informe um nome para a API key.")
      return
    }

    const token = getAuthToken()
    if (!token) {
      setErrorMessage("Sessão inválida. Faça login novamente.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(apiUrl("/auth/api-keys"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: apiKeyName.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível gerar a API key.")
        return
      }

      setSuccessMessage("API key gerada com sucesso.")
      setCopied(false)
      await loadApiKeys()
    } catch {
      setErrorMessage(`Erro de conexão com a API em ${getApiBaseUrl()}.`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyApiKey() {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
  }

  return (
    <div className="space-y-6">
      <div className="w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas credenciais de integração da API.
          </p>
        </div>

        <Card>
          <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <KeyRound className="h-4 w-4 sm:h-5 sm:w-5" />
              API Key
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Gere uma chave para autenticar requisições no seu backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Nome da API key</p>
              <Input
                value={apiKeyName}
                onChange={(event) => setApiKeyName(event.target.value)}
                placeholder="Ex.: Integração checkout"
                className="w-full"
              />
            </div>

            <div className="rounded-md border border-border bg-secondary/40 p-3 sm:p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Chave atual</p>
              <p className="break-all font-mono text-xs sm:text-sm">
                {apiKey || "Nenhuma chave gerada ainda."}
              </p>
            </div>

            {apiKeys.length > 0 && (
              <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3 sm:p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Chaves criadas</p>
                <div className="space-y-2">
                  {apiKeys.map((item) => (
                    <div key={item.id} className="flex flex-col gap-0.5 rounded border border-border bg-background p-2 sm:p-3">
                      <p className="text-xs font-semibold">{item.name}</p>
                      <p className="break-all font-mono text-xs text-muted-foreground">{item.api_key}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorMessage && (
              <p className="text-sm text-red-500" role="alert">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="text-sm text-green-600" role="status">
                {successMessage}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button onClick={handleGenerateApiKey} className="w-full gap-2 sm:w-auto" disabled={isLoading}>
                <ShieldCheck className="h-4 w-4" />
                {isLoading ? "Gerando..." : "Gerar API key"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyApiKey}
                disabled={!apiKey}
                className="w-full gap-2 sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copiada" : "Copiar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
