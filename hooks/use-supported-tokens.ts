"use client"

import { useEffect, useMemo, useState } from "react"
import { apiUrl } from "@/lib/api-url"

type SupportedTokens = Record<string, Record<string, string>>

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

export function useSupportedTokens() {
  const [supportedTokens, setSupportedTokens] = useState<SupportedTokens>({})

  useEffect(() => {
    let ignore = false

    async function loadSupportedTokens() {
      try {
        const response = await fetch(apiUrl("/supported-chains"))
        const data = await response.json()
        if (!ignore && response.ok && data && typeof data === "object") {
          setSupportedTokens(data)
        }
      } catch {
        if (!ignore) setSupportedTokens({})
      }
    }

    loadSupportedTokens().catch(() => {})

    return () => {
      ignore = true
    }
  }, [])

  const tokenSymbolByAddress = useMemo(() => {
    const byAddress = new Map<string, string>()

    for (const tokens of Object.values(supportedTokens)) {
      for (const [symbol, address] of Object.entries(tokens)) {
        byAddress.set(normalize(address), symbol.toUpperCase())
      }
    }

    return byAddress
  }, [supportedTokens])

  return {
    supportedTokens,
    getTokenSymbol(token: string | null | undefined) {
      return tokenSymbolByAddress.get(normalize(token))
    },
  }
}
