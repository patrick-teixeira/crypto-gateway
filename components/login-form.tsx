"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { apiUrl, getApiBaseUrl } from "@/lib/api-url"
import { clearLegacyAuthStorage, setAuthToken } from "@/lib/auth-session"

interface LoginFormProps {
  onAuthSuccess?: () => void
  initialSuccessMessage?: string
}

export function LoginForm({ onAuthSuccess, initialSuccessMessage = "" }: LoginFormProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot-password">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState(initialSuccessMessage)

  const isLoginMode = mode === "login"
  const isRegisterMode = mode === "register"
  const isForgotPasswordMode = mode === "forgot-password"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    if (isRegisterMode && password !== confirmPassword) {
      setErrorMessage("As senhas não conferem.")
      return
    }

    setIsLoading(true)

    try {
      const endpoint = isForgotPasswordMode
        ? apiUrl("/auth/forgot-password")
        : isLoginMode
          ? apiUrl("/auth/login")
          : apiUrl("/auth/register")

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isForgotPasswordMode ? { email } : { email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível concluir a solicitação.")
        return
      }

      if (isForgotPasswordMode) {
        setSuccessMessage("Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.")
        setPassword("")
        setConfirmPassword("")
      } else if (isLoginMode) {
        if (data.token) {
          const userSession = JSON.stringify(data.user ?? {})
          sessionStorage.setItem("auth_user", userSession)
          setAuthToken(data.token, rememberMe)
          if (rememberMe) {
            localStorage.setItem("auth_user", userSession)
          } else {
            localStorage.removeItem("auth_user")
          }
        }
        setSuccessMessage("Login realizado com sucesso.")
        onAuthSuccess?.()
      } else {
        clearLegacyAuthStorage()
        setSuccessMessage("Cadastro realizado com sucesso. Faça seu login.")
        setMode("login")
        setPassword("")
        setConfirmPassword("")
      }
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
          <h2 className="text-3xl font-bold tracking-tight">
            {isForgotPasswordMode ? "Recuperar senha" : isLoginMode ? "Bem-vindo de volta" : "Criar conta"}
          </h2>
          <p className="text-muted-foreground">
            {isForgotPasswordMode
              ? "Informe seu e-mail para receber o link de recuperação"
              : isLoginMode
                ? "Entre com suas credenciais para acessar sua conta"
                : "Preencha os dados para criar sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            {!isForgotPasswordMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Senha</Label>
                  {isLoginMode && (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        setMode("forgot-password")
                        setErrorMessage("")
                        setSuccessMessage("")
                        setPassword("")
                        setConfirmPassword("")
                      }}
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
            )}

            {isRegisterMode && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
            )}

            {isLoginMode && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Lembrar de mim
                </Label>
              </div>
            )}
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

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium"
            disabled={isLoading}
          >
            {isLoading
              ? isLoginMode
                ? "Entrando..."
                : isForgotPasswordMode
                  ? "Enviando..."
                  : "Cadastrando..."
              : isLoginMode
                ? "Entrar"
                : isForgotPasswordMode
                  ? "Enviar link"
                  : "Cadastrar"}
          </Button>

        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isForgotPasswordMode ? (
            <>
              Lembrou sua senha?{" "}
              <button
                type="button"
                className="font-medium text-foreground hover:underline"
                onClick={() => {
                  setMode("login")
                  setErrorMessage("")
                  setSuccessMessage("")
                  setPassword("")
                  setConfirmPassword("")
                }}
              >
                Entrar
              </button>
            </>
          ) : (
            <>
              {isLoginMode ? "Ainda não tem uma conta? " : "Já possui uma conta? "}
              <button
                type="button"
                className="font-medium text-foreground hover:underline"
                onClick={() => {
                  setMode(isLoginMode ? "register" : "login")
                  setErrorMessage("")
                  setSuccessMessage("")
                  setPassword("")
                  setConfirmPassword("")
                }}
              >
                {isLoginMode ? "Criar conta" : "Entrar"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
