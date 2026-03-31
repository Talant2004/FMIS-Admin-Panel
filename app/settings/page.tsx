import { Navigation } from "@/components/navigation"

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="p-6 text-sm text-muted-foreground">
        Настройки в разработке. Раздел открыт и доступен по навигации.
      </div>
    </main>
  )
}
