import { AuthGate } from "@/components/auth-gate"

export default function WalletPage() {
  return <AuthGate initialView="wallets" />
}
