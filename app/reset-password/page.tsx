"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiUrl, getApiBaseUrl } from "@/lib/api-url"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token") ?? "")
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    if (!token) {
      setErrorMessage("Link de recuperação inválido.")
      return
    }
    if (password.length < 6) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage("As senhas não conferem.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(apiUrl("/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível redefinir a senha.")
        return
      }

      setSuccessMessage("Senha redefinida com sucesso.")
      window.setTimeout(() => router.replace("/login?reset=success"), 900)
    } catch {
      setErrorMessage(`Erro de conexão com a API em ${getApiBaseUrl()}.`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Criar nova senha</h2>
          <p className="text-muted-foreground">Digite uma nova senha para acessar sua conta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua nova senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita sua nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="h-12"
              />
            </div>
          </div>

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

          <Button type="submit" className="h-12 w-full text-base font-medium" disabled={isLoading || !token}>
            {isLoading ? "Redefinindo..." : "Redefinir senha"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Lembrou sua senha?{" "}
          <button
            type="button"
            className="font-medium text-foreground hover:underline"
            onClick={() => router.push("/login")}
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  )
}
