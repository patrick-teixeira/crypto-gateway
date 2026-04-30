import { AuthGate } from "@/components/auth-gate"

export default function SettingsPage() {
  return <AuthGate initialView="settings" />
}
