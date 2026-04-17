"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getEnterprises } from "@/lib/firestore-enterprises"
import { mockEnterprises } from "@/lib/mock-data"
import type { Enterprise } from "@/lib/types"

const EnterprisesMap = dynamic(
  () => import("@/components/enterprises-map").then((mod) => mod.EnterprisesMap),
  { ssr: false }
)

export default function MapPage() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomToEnterpriseId, setZoomToEnterpriseId] = useState<string | null>(null)
  const [zoomToFieldId, setZoomToFieldId] = useState<string | null>(null)
  const [zoomRequestToken, setZoomRequestToken] = useState(0)
  const selectedEnterprise = enterprises.find((item) => item.id === selectedId) ?? null

  const selectedEnterpriseFields = selectedEnterprise?.geojson?.features.map((feature, index) => {
    const properties = (feature.properties as Record<string, unknown> | null) ?? {}
    const fieldId = String(properties.fieldId ?? `${selectedEnterprise.id}-F${String(index + 1).padStart(3, "0")}`)
    const fieldName = String(properties.fieldName ?? properties.name ?? `Поле ${index + 1}`)
    return { id: fieldId, name: fieldName }
  }) ?? []

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const data = await getEnterprises()
        const prepared = data.length ? data : mockEnterprises
        if (!isMounted) return
        setEnterprises(prepared)
        setSelectedId(prepared[0]?.id ?? null)
      } catch {
        if (!isMounted) return
        setEnterprises(mockEnterprises)
        setSelectedId(mockEnterprises[0]?.id ?? null)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="grid h-[calc(100vh-50px)] grid-cols-[1.4fr_1fr]">
        <div className="h-full">
          <div className="border-b p-3 text-sm font-medium">Карта полей</div>
          <div className="h-[calc(100%-45px)]">
            <EnterprisesMap
              enterprises={enterprises}
              selectedId={selectedId}
              zoomToEnterpriseId={zoomToEnterpriseId}
              zoomToFieldId={zoomToFieldId}
              zoomRequestToken={zoomRequestToken}
            />
          </div>
        </div>
        <div className="border-l">
          <div className="border-b p-3 text-sm font-medium">Предприятия</div>
          <div className="space-y-2 p-3">
            {enterprises.map((enterprise) => (
              <Button
                key={enterprise.id}
                variant={selectedId === enterprise.id ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => {
                  setSelectedId(enterprise.id)
                  setZoomToFieldId(null)
                }}
                onDoubleClick={() => {
                  setSelectedId(enterprise.id)
                  setZoomToEnterpriseId(enterprise.id)
                  setZoomToFieldId(null)
                  setZoomRequestToken((prev) => prev + 1)
                }}
              >
                {enterprise.name}
              </Button>
            ))}
            {selectedEnterprise && selectedEnterpriseFields.length > 0 && (
              <div className="space-y-2 pt-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Поля хозяйства: {selectedEnterprise.name}
                </div>
                <Select
                  value={zoomToFieldId ?? ""}
                  onValueChange={(value) => {
                    setZoomToFieldId(value)
                    setZoomToEnterpriseId(selectedEnterprise.id)
                    setZoomRequestToken((prev) => prev + 1)
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выбрать поле" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedEnterpriseFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name} ({field.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
