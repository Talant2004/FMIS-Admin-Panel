"use client"

import { useEffect, useState } from "react"
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
      }
    }
  }

  const handleUpdateEnterprise = async (id: string, updates: Partial<Enterprise>) => {
    setEnterprises((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
    try {
      await updateEnterprise(id, updates)
    } catch (error) {
      console.warn("Failed to update enterprise in Firestore.", error)
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
    }
  }

  const handleCreateEnterprise = async (data: CreateEnterpriseData) => {
    const parseNumber = (value: string) => {
      const normalized = Number(value.replace(",", "."))
      return Number.isFinite(normalized) ? normalized : 0
    }

    const newId = String(enterprises.length + 1).padStart(5, "0")
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

    setEnterprises((prev) => [...prev, newEnterprise])
    setSelectedId(newId)

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
        setEnterprises((prev) =>
          prev.map((e) => (e.id === newId ? { ...e, ...assetUpdates } : e))
        )
      }
    } catch (error) {
      console.warn("Failed to create enterprise in Firestore.", error)
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
