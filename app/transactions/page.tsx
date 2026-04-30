import { AuthGate } from "@/components/auth-gate"

export default function TransactionsPage() {
  return <AuthGate initialView="transactions" />
}
