"use client"

import { JournalPageContent } from "@/app/journal/page"
import { RequireAuth } from "@/components/auth/require-auth"
import { Navigation } from "@/components/navigation"

export default function MyJournalPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <RequireAuth
        title="Вход в мой журнал"
        description="Здесь только ваши полевые пробы."
      >
        <JournalPageContent variant="mine" />
      </RequireAuth>
    </main>
  )
}
