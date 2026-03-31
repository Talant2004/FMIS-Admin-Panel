import { Navigation } from "@/components/navigation"
import { EnterprisesPage } from "@/components/enterprises-page"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <EnterprisesPage />
    </main>
  )
}
