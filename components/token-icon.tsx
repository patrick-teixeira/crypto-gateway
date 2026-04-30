"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export type TokenMeta = {
  symbol: string
  name: string
  classes: string
  text: string
}

const TOKEN_META_BY_KEY: Record<string, TokenMeta> = {
  usdc: {
    symbol: "USDC",
    name: "USD Coin",
    classes: "bg-[#2775ca] text-white ring-[#2775ca]/20",
    text: "$",
  },
  ron: {
    symbol: "RON",
    name: "Ronin",
    classes: "bg-[#1273ea] text-white ring-[#1273ea]/20",
    text: "R",
  },
  ronin: {
    symbol: "RON",
    name: "Ronin",
    classes: "bg-[#1273ea] text-white ring-[#1273ea]/20",
    text: "R",
  },
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

function fallbackSymbol(token: string | null | undefined) {
  const raw = String(token ?? "").trim()
  if (!raw) return "Token"
  if (raw.startsWith("0x") && raw.length > 12) return `${raw.slice(0, 6)}...${raw.slice(-4)}`
  return raw.toUpperCase()
}

function getIconCandidates(token: string | null | undefined, symbol: string) {
  const normalizedToken = normalizeToken(token)
  const normalizedSymbol = normalizeToken(symbol)
  const names = [normalizedSymbol, normalizedToken].filter(Boolean)
  const uniqueNames = Array.from(new Set(names))

  return uniqueNames.flatMap((name) => [
    `/icons/${name}.png`,
    `/icons/${name}.svg`,
    `/icons/${name}.webp`,
  ])
}

export function getTokenMeta(token: string | null | undefined, symbolOverride?: string): TokenMeta {
  if (symbolOverride) {
    const symbol = symbolOverride.toUpperCase()
    const meta = TOKEN_META_BY_KEY[normalizeToken(symbol)]
    return meta ?? {
      symbol,
      name: symbol,
      classes: "bg-muted text-muted-foreground ring-border",
      text: symbol.slice(0, 2).toUpperCase(),
    }
  }

  const key = normalizeToken(token)
  const meta = TOKEN_META_BY_KEY[key]
  if (meta) return meta

  const symbol = fallbackSymbol(token)
  return {
    symbol,
    name: symbol,
    classes: "bg-muted text-muted-foreground ring-border",
    text: symbol.slice(0, 2).toUpperCase(),
  }
}

export function TokenIcon({
  token,
  symbol,
  className,
}: {
  token: string | null | undefined
  symbol?: string
  className?: string
}) {
  const meta = getTokenMeta(token, symbol)
  const iconCandidates = useMemo(() => getIconCandidates(token, meta.symbol), [token, meta.symbol])
  const iconKey = `${normalizeToken(token)}:${normalizeToken(meta.symbol)}`
  const [iconState, setIconState] = useState({ key: iconKey, index: 0 })
  const iconIndex = iconState.key === iconKey ? iconState.index : 0
  const iconSrc = iconCandidates[iconIndex]

  return (
    <span
      aria-label={meta.name}
      title={meta.name}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-4",
        meta.classes,
        className
      )}
    >
      {iconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconSrc}
          alt=""
          className="h-full w-full rounded-full object-cover"
          onError={() => setIconState((current) => ({
            key: iconKey,
            index: current.key === iconKey ? current.index + 1 : 1,
          }))}
        />
      ) : (
        meta.text
      )}
    </span>
  )
}
