"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { EnterprisesList } from "@/components/enterprises-list"
import { EnterpriseDetails } from "@/components/enterprise-details"
import { CreateEnterpriseDialog, type CreateEnterpriseData } from "@/components/create-enterprise-dialog"
import { mockEnterprises, masterCollections } from "@/lib/mock-data"
import type { Enterprise } from "@/lib/types"
import {
  getEnterprises,
  removeEnterprise,
  saveEnterprise,
  updateEnterprise,
  updateEnterpriseActive,
} from "@/lib/firestore-enterprises"
import { uploadEnterpriseAsset, type EnterpriseAssetField } from "@/lib/storage-enterprises"

export function EnterprisesPage() {
  const getErrorMessage = (error: unknown) => {
    if (typeof error === "object" && error !== null) {
      const maybeError = error as { code?: string; message?: string }
      if (maybeError.code || maybeError.message) {
        return [maybeError.code, maybeError.message].filter(Boolean).join(": ")
      }
    }
    return "Unknown error"
  }

  const [enterprises, setEnterprises] = useState<Enterprise[]>(mockEnterprises)
  const [selectedId, setSelectedId] = useState<string | null>(mockEnterprises[0]?.id || null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const selectedEnterprise = enterprises.find((e) => e.id === selectedId)

  useEffect(() => {
    let isMounted = true

    const loadEnterprises = async () => {
      try {
        const firestoreEnterprises = await getEnterprises()
        if (!isMounted) return

        if (firestoreEnterprises.length > 0) {
          setEnterprises(firestoreEnterprises)
          setSelectedId(firestoreEnterprises[0].id)
        } else {
          setEnterprises(mockEnterprises)
          setSelectedId(mockEnterprises[0]?.id || null)
        }
      } catch (error) {
        console.warn("Firestore is unavailable, using local mock enterprises.", error)
        if (!isMounted) return
        setEnterprises(mockEnterprises)
        setSelectedId(mockEnterprises[0]?.id || null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadEnterprises()
    return () => {
      isMounted = false
    }
  }, [])

  const handleToggleActive = async (id: string, active: boolean) => {
    setEnterprises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isActive: active } : e))
    )

    try {
      await updateEnterpriseActive(id, active)
    } catch (error) {
      console.warn("Failed to update enterprise status in Firestore.", error)
      toast.error(`Ошибка обновления статуса: ${getErrorMessage(error)}`)
      setEnterprises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, isActive: !active } : e))
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Вы уверены, что хотите удалить это предприятие?")) {
      setEnterprises((prev) => prev.filter((e) => e.id !== id))
      if (selectedId === id) {
        setSelectedId(enterprises.find((e) => e.id !== id)?.id || null)
      }
      try {
        await removeEnterprise(id)
      } catch (error) {
        console.warn("Failed to delete enterprise from Firestore.", error)
        toast.error(`Ошибка удаления: ${getErrorMessage(error)}`)
      }
    }
  }

  const handleUpdateEnterprise = async (id: string, updates: Partial<Enterprise>) => {
    setEnterprises((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
    try {
      await updateEnterprise(id, updates)
    } catch (error) {
      console.warn("Failed to update enterprise in Firestore.", error)
      toast.error(`Ошибка сохранения: ${getErrorMessage(error)}`)
    }
  }

  const handleUploadAsset = async (
    id: string,
    field: EnterpriseAssetField,
    file: File
  ) => {
    try {
      const downloadUrl = await uploadEnterpriseAsset(id, field, file)
      await handleUpdateEnterprise(id, { [field]: downloadUrl })
    } catch (error) {
      console.warn("Failed to upload enterprise asset.", error)
      toast.error(`Ошибка загрузки файла: ${getErrorMessage(error)}`)
    }
  }

  const handleCreateEnterprise = async (data: CreateEnterpriseData) => {
    const parseNumber = (value: string) => {
      const normalized = Number(value.replace(",", "."))
      return Number.isFinite(normalized) ? normalized : 0
    }

    const maxId = enterprises.reduce((max, enterprise) => {
      const numericId = Number(enterprise.id)
      return Number.isFinite(numericId) ? Math.max(max, numericId) : max
    }, 0)
    let nextNumericId = maxId + 1
    let newId = String(nextNumericId).padStart(5, "0")
    const existingIds = new Set(enterprises.map((enterprise) => enterprise.id))
    while (existingIds.has(newId)) {
      nextNumericId += 1
      newId = String(nextNumericId).padStart(5, "0")
    }
    const today = new Date()
    const createdAt = data.createdAt.day && data.createdAt.month && data.createdAt.year
      ? `${data.createdAt.day}/${data.createdAt.month}/${data.createdAt.year}`
      : `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`

    const newEnterprise: Enterprise = {
      id: newId,
      name: data.fullName,
      shortName: data.shortName,
      director: data.director,
      phone: data.phone,
      email: data.email,
      address: data.address,
      iban: "",
      createdAt,
      referencePoint: {
        x: parseFloat(data.referencePoint.x) || 0,
        y: parseFloat(data.referencePoint.y) || 0,
      },
      geojson: data.geojson,
      tags: [],
      isActive: !data.isInactive,
      totalFieldArea: parseNumber(data.totalFieldArea),
      irrigatedArea: parseNumber(data.irrigatedArea),
      nonIrrigatedArea: parseNumber(data.nonIrrigatedArea),
      fieldsCount: parseNumber(data.fieldsCount),
      productionPlansCount: parseNumber(data.productionPlansCount),
      avgFieldSize: parseNumber(data.avgFieldSize),
      culturesCount: parseNumber(data.culturesCount),
      employeesCount: parseNumber(data.employeesCount),
      activeNow: parseNumber(data.activeNow),
      machinesCount: parseNumber(data.machinesCount),
      unitsCount: parseNumber(data.unitsCount),
      hasWeatherStation: data.hasWeatherStation,
      expectedGrossYield: parseNumber(data.expectedGrossYield),
      expectedGrossProfit: parseNumber(data.expectedGrossProfit),
      profitability: parseNumber(data.profitability),
      grossYieldCurrentSeason: parseNumber(data.grossYieldCurrentSeason),
    }

    try {
      await saveEnterprise(newEnterprise)
      const assetUpdates: Partial<Enterprise> = {}

      if (data.logo) {
        assetUpdates.logo = await uploadEnterpriseAsset(newId, "logo", data.logo)
      }
      if (data.banner) {
        assetUpdates.banner = await uploadEnterpriseAsset(newId, "banner", data.banner)
      }

      if (Object.keys(assetUpdates).length > 0) {
        await updateEnterprise(newId, assetUpdates)
        newEnterprise.logo = assetUpdates.logo ?? newEnterprise.logo
        newEnterprise.banner = assetUpdates.banner ?? newEnterprise.banner
      }
      setEnterprises((prev) => [...prev, newEnterprise])
      setSelectedId(newId)
      toast.success("Предприятие создано")
    } catch (error) {
      console.warn("Failed to create enterprise in Firestore.", error)
      toast.error(`Не удалось создать предприятие: ${getErrorMessage(error)}`)
    }
  }

  return (
    <>
      <div className="grid h-[calc(100vh-50px)] grid-cols-[1fr_1.2fr]">
        <EnterprisesList
          enterprises={enterprises}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreateNew={() => setCreateDialogOpen(true)}
        />

        {selectedEnterprise ? (
          <EnterpriseDetails
            enterprise={selectedEnterprise}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            onUpdateEnterprise={handleUpdateEnterprise}
            onUploadAsset={handleUploadAsset}
          />
        ) : (
          <div className="flex items-center justify-center text-muted-foreground">
            {isLoading ? "Загрузка предприятий..." : "Выберите предприятие для просмотра деталей"}
          </div>
        )}
      </div>

      <CreateEnterpriseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        masterCollections={masterCollections}
        onSubmit={handleCreateEnterprise}
      />
    </>
  )
}
