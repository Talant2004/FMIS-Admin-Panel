"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, Pencil, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Enterprise } from "@/lib/types"
import type { EnterpriseAssetField } from "@/lib/storage-enterprises"

interface EnterpriseDetailsProps {
  enterprise: Enterprise
  onToggleActive: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onUpdateEnterprise: (id: string, updates: Partial<Enterprise>) => Promise<void>
  onUploadAsset: (id: string, field: EnterpriseAssetField, file: File) => Promise<void>
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {value && <span className="ml-2 text-sm text-foreground">{value}</span>}
    </div>
  )
}

function UploadRow({
  label,
  hasValue,
  url,
  onUploadClick,
}: {
  label: string
  hasValue: boolean
  url?: string
  onUploadClick: () => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-green-700 underline underline-offset-4 hover:text-green-800"
        >
          {label}
        </a>
      ) : (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
      <div className="flex items-center gap-3">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Открыть
          </a>
        )}
        <Button
          variant="link"
          className="h-auto p-0 text-sm text-green-600 hover:text-green-700"
          onClick={onUploadClick}
        >
          {hasValue ? "Изменить" : "Загрузить"}
        </Button>
      </div>
    </div>
  )
}

export function EnterpriseDetails({
  enterprise,
  onToggleActive,
  onDelete,
  onUpdateEnterprise,
  onUploadAsset,
}: EnterpriseDetailsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState({
    name: enterprise.name,
    shortName: enterprise.shortName,
    address: enterprise.address,
    director: enterprise.director,
    phone: enterprise.phone,
    email: enterprise.email,
    iban: enterprise.iban,
    tags: enterprise.tags.join(", "),
    totalFieldArea: String(enterprise.totalFieldArea),
    irrigatedArea: String(enterprise.irrigatedArea),
    nonIrrigatedArea: String(enterprise.nonIrrigatedArea),
    fieldsCount: String(enterprise.fieldsCount),
    productionPlansCount: String(enterprise.productionPlansCount),
    avgFieldSize: String(enterprise.avgFieldSize),
    culturesCount: String(enterprise.culturesCount),
    referenceX: String(enterprise.referencePoint.x),
    referenceY: String(enterprise.referencePoint.y),
  })

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft({
      name: enterprise.name,
      shortName: enterprise.shortName,
      address: enterprise.address,
      director: enterprise.director,
      phone: enterprise.phone,
      email: enterprise.email,
      iban: enterprise.iban,
      tags: enterprise.tags.join(", "),
      totalFieldArea: String(enterprise.totalFieldArea),
      irrigatedArea: String(enterprise.irrigatedArea),
      nonIrrigatedArea: String(enterprise.nonIrrigatedArea),
      fieldsCount: String(enterprise.fieldsCount),
      productionPlansCount: String(enterprise.productionPlansCount),
      avgFieldSize: String(enterprise.avgFieldSize),
      culturesCount: String(enterprise.culturesCount),
      referenceX: String(enterprise.referencePoint.x),
      referenceY: String(enterprise.referencePoint.y),
    })
    setIsEditing(false)
  }, [enterprise])

  const formatNumber = (num: number) => {
    return num.toLocaleString("ru-RU")
  }

  const saveEnterprise = async () => {
    const parseNumber = (value: string) => {
      const normalized = Number(value.replace(",", "."))
      return Number.isFinite(normalized) ? normalized : 0
    }

    setIsSaving(true)
    try {
      await onUpdateEnterprise(enterprise.id, {
        name: draft.name.trim(),
        shortName: draft.shortName.trim(),
        address: draft.address.trim(),
        director: draft.director.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        iban: draft.iban.trim(),
        tags: draft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        totalFieldArea: parseNumber(draft.totalFieldArea),
        irrigatedArea: parseNumber(draft.irrigatedArea),
        nonIrrigatedArea: parseNumber(draft.nonIrrigatedArea),
        fieldsCount: parseNumber(draft.fieldsCount),
        productionPlansCount: parseNumber(draft.productionPlansCount),
        avgFieldSize: parseNumber(draft.avgFieldSize),
        culturesCount: parseNumber(draft.culturesCount),
        referencePoint: {
          x: parseNumber(draft.referenceX),
          y: parseNumber(draft.referenceY),
        },
      })
      setIsEditing(false)
      toast.success("Изменения сохранены")
    } catch (error) {
      toast.error("Не удалось сохранить изменения")
      console.warn("Failed to save enterprise changes.", error)
    } finally {
      setIsSaving(false)
    }
  }

  const triggerUpload = async (field: EnterpriseAssetField, file?: File) => {
    if (!file) return
    try {
      await onUploadAsset(enterprise.id, field, file)
      toast.success("Файл загружен")
    } catch (error) {
      toast.error("Не удалось загрузить файл")
      console.warn("Failed to upload file.", error)
    }
  }

  const copyLog = async () => {
    const payload = {
      id: enterprise.id,
      name: enterprise.name,
      isActive: enterprise.isActive,
      updatedAt: new Date().toISOString(),
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    toast.success("Лог скопирован в буфер обмена")
  }

  const openMap = () => {
    const x = isEditing ? draft.referenceX : String(enterprise.referencePoint.x)
    const y = isEditing ? draft.referenceY : String(enterprise.referencePoint.y)
    if (!x || !y) return
    window.open(`https://www.google.com/maps?q=${x},${y}`, "_blank", "noopener,noreferrer")
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            {isEditing ? (
              <Input
                className="h-9 text-base font-semibold"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
            ) : (
              <h1 className="text-xl font-semibold text-foreground">{enterprise.name}</h1>
            )}
            <p className="text-sm text-muted-foreground">ID:{enterprise.id}</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" className="h-8" onClick={() => setIsEditing(false)}>
                  Отмена
                </Button>
                <Button className="h-8 bg-green-600 hover:bg-green-700" onClick={saveEnterprise} disabled={isSaving}>
                  Сохранить
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(enterprise.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_180px] gap-6">
          <div className="space-y-1">
            {isEditing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Общая площадь полей (га)</span>
                  <Input value={draft.totalFieldArea} onChange={(e) => setDraft((prev) => ({ ...prev, totalFieldArea: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[1fr_120px_120px] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Орошаемое/неорошаемое</span>
                  <Input value={draft.irrigatedArea} onChange={(e) => setDraft((prev) => ({ ...prev, irrigatedArea: e.target.value }))} placeholder="Орошаемое" />
                  <Input value={draft.nonIrrigatedArea} onChange={(e) => setDraft((prev) => ({ ...prev, nonIrrigatedArea: e.target.value }))} placeholder="Неорошаемое" />
                </div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Количество полей</span>
                  <Input value={draft.fieldsCount} onChange={(e) => setDraft((prev) => ({ ...prev, fieldsCount: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Производственных планов</span>
                  <Input value={draft.productionPlansCount} onChange={(e) => setDraft((prev) => ({ ...prev, productionPlansCount: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Средний размер поля (га)</span>
                  <Input value={draft.avgFieldSize} onChange={(e) => setDraft((prev) => ({ ...prev, avgFieldSize: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Количество культур</span>
                  <Input value={draft.culturesCount} onChange={(e) => setDraft((prev) => ({ ...prev, culturesCount: e.target.value }))} />
                </div>
              </div>
            ) : (
              <>
                <StatRow label="Общая площадь полей" value={`${enterprise.totalFieldArea} га`} />
                <StatRow
                  label="Орошаемое/неорошаемое"
                  value={`${enterprise.irrigatedArea}/${enterprise.nonIrrigatedArea}`}
                />
                <StatRow label="Количество полей" value={enterprise.fieldsCount} />
                <StatRow label="Производственных планов" value={enterprise.productionPlansCount} />
                <StatRow label="Средний размер поля" value={`${enterprise.avgFieldSize} га`} />
                <StatRow label="Количество культур" value={enterprise.culturesCount} />
              </>
            )}
          </div>

          <div className="flex h-[140px] flex-col items-center justify-center gap-2 rounded-md bg-green-200/60 text-sm text-green-800">
            <div>Миникарта (все поля)</div>
            <div className="text-xs text-green-900">
              X: {isEditing ? draft.referenceX : enterprise.referencePoint.x} / Y:{" "}
              {isEditing ? draft.referenceY : enterprise.referencePoint.y}
            </div>
            {isEditing && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={draft.referenceX}
                  onChange={(e) => setDraft((prev) => ({ ...prev, referenceX: e.target.value }))}
                  placeholder="X"
                  className="h-8 bg-white"
                />
                <Input
                  value={draft.referenceY}
                  onChange={(e) => setDraft((prev) => ({ ...prev, referenceY: e.target.value }))}
                  placeholder="Y"
                  className="h-8 bg-white"
                />
              </div>
            )}
            <Button variant="link" className="h-auto p-0 text-green-700" onClick={openMap}>
              <MapPin className="mr-1 h-3 w-3" />
              На карте
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-0.5">
          {isEditing ? (
            <div className="space-y-2">
              <Input value={draft.shortName} onChange={(e) => setDraft((prev) => ({ ...prev, shortName: e.target.value }))} placeholder="Короткое название" />
              <Input value={draft.address} onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))} placeholder="Адрес" />
              <Input value={draft.director} onChange={(e) => setDraft((prev) => ({ ...prev, director: e.target.value }))} placeholder="Директор" />
              <Input value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" />
              <Input value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
              <Input value={draft.iban} onChange={(e) => setDraft((prev) => ({ ...prev, iban: e.target.value }))} placeholder="IBAN" />
            </div>
          ) : (
            <>
              <InfoRow label="Адрес" value={enterprise.address} />
              <InfoRow label="Директор" value={enterprise.director} />
              <InfoRow label="Телефон" value={enterprise.phone} />
              <InfoRow label="Email" value={enterprise.email} />
              <InfoRow label="IBAN" value={enterprise.iban} />
            </>
          )}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <StatRow label="Количество сотрудников" value={enterprise.employeesCount} />
          <StatRow label="Активно сейчас:" value={enterprise.activeNow} />
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">Администратор</span>
            <Button
              variant="link"
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
            >
              (Настройка)
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <StatRow label="Количество машин" value={enterprise.machinesCount} />
          <StatRow label="Количество агрегатов" value={enterprise.unitsCount} />
          <StatRow
            label="Аппаратная метеостания (есть/нет)"
            value={enterprise.hasWeatherStation ? "да" : "нет"}
          />
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <StatRow
            label="Ожидаемый валовый сбор, KZT"
            value={`${formatNumber(enterprise.expectedGrossYield)} T`}
          />
          <StatRow
            label="Ожидаемая валовая прибыль, KZT"
            value={`${formatNumber(enterprise.expectedGrossProfit)} T`}
          />
          <StatRow label="Рентабельность, %" value={`${enterprise.profitability} %`} />
          <StatRow label="Валовый сбор за текущий сезон, Т" value={enterprise.grossYieldCurrentSeason || ""} />
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-foreground">Предприятие активно</span>
          <Switch
            checked={enterprise.isActive}
            onCheckedChange={(checked) => onToggleActive(enterprise.id, checked)}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        <Button
          variant="link"
          className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
          onClick={copyLog}
        >
          Лог
        </Button>

        <Separator className="my-4" />

        <div className="space-y-1">
          <UploadRow
            label="Логотип"
            hasValue={Boolean(enterprise.logo)}
            url={enterprise.logo}
            onUploadClick={() => logoInputRef.current?.click()}
          />
          <UploadRow
            label="Фавикон"
            hasValue={Boolean(enterprise.favicon)}
            url={enterprise.favicon}
            onUploadClick={() => faviconInputRef.current?.click()}
          />
          <UploadRow
            label="Банер"
            hasValue={Boolean(enterprise.banner)}
            url={enterprise.banner}
            onUploadClick={() => bannerInputRef.current?.click()}
          />
          <UploadRow
            label="Обложка для приложения"
            hasValue={Boolean(enterprise.appCover)}
            url={enterprise.appCover}
            onUploadClick={() => coverInputRef.current?.click()}
          />
          <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => triggerUpload("logo", e.target.files?.[0])} />
          <input ref={faviconInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => triggerUpload("favicon", e.target.files?.[0])} />
          <input ref={bannerInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => triggerUpload("banner", e.target.files?.[0])} />
          <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => triggerUpload("appCover", e.target.files?.[0])} />
        </div>

      </div>
    </ScrollArea>
  )
}
