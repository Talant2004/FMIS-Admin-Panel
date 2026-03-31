"use client"

import { useState } from "react"
import { MapPin, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { MasterCollection } from "@/lib/types"

interface CreateEnterpriseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  masterCollections: MasterCollection[]
  onSubmit: (data: CreateEnterpriseData) => void
}

export interface CreateEnterpriseData {
  fullName: string
  shortName: string
  director: string
  phone: string
  email: string
  address: string
  createdAt: { day: string; month: string; year: string }
  referencePoint: { x: string; y: string }
  logo?: File
  banner?: File
  totalFieldArea: string
  irrigatedArea: string
  nonIrrigatedArea: string
  fieldsCount: string
  productionPlansCount: string
  avgFieldSize: string
  culturesCount: string
  employeesCount: string
  activeNow: string
  machinesCount: string
  unitsCount: string
  hasWeatherStation: boolean
  expectedGrossYield: string
  expectedGrossProfit: string
  profitability: string
  grossYieldCurrentSeason: string
  isInactive: boolean
  masterCollections: {
    plantProtection: { enabled: boolean; collectionId: string }
    fertilizers: { enabled: boolean; collectionId: string }
    pests: { enabled: boolean; collectionId: string }
    diseases: { enabled: boolean; collectionId: string }
    weeds: { enabled: boolean; collectionId: string }
    cultures: { enabled: boolean; collectionId: string }
    roles: { enabled: boolean; collectionId: string }
  }
}

const getDefaultFormData = (): CreateEnterpriseData => ({
  fullName: "",
  shortName: "",
  director: "",
  phone: "",
  email: "",
  address: "",
  createdAt: { day: "", month: "", year: "" },
  referencePoint: { x: "", y: "" },
  logo: undefined,
  banner: undefined,
  totalFieldArea: "0",
  irrigatedArea: "0",
  nonIrrigatedArea: "0",
  fieldsCount: "0",
  productionPlansCount: "0",
  avgFieldSize: "0",
  culturesCount: "0",
  employeesCount: "0",
  activeNow: "0",
  machinesCount: "0",
  unitsCount: "0",
  hasWeatherStation: false,
  expectedGrossYield: "0",
  expectedGrossProfit: "0",
  profitability: "0",
  grossYieldCurrentSeason: "0",
  isInactive: false,
  masterCollections: {
    plantProtection: { enabled: true, collectionId: "master-main" },
    fertilizers: { enabled: true, collectionId: "master-main" },
    pests: { enabled: true, collectionId: "master-main" },
    diseases: { enabled: false, collectionId: "" },
    weeds: { enabled: false, collectionId: "" },
    cultures: { enabled: true, collectionId: "master-north" },
    roles: { enabled: true, collectionId: "master-main" },
  },
})

interface MasterCollectionRowProps {
  label: string
  checked: boolean
  collectionId: string
  collections: MasterCollection[]
  onCheckedChange: (checked: boolean) => void
  onCollectionChange: (id: string) => void
}

function MasterCollectionRow({
  label,
  checked,
  collectionId,
  collections,
  onCheckedChange,
  onCollectionChange,
}: MasterCollectionRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
      />
      <Select
        value={collectionId}
        onValueChange={onCollectionChange}
        disabled={!checked}
      >
        <SelectTrigger className={`h-8 ${!checked ? "opacity-50" : ""}`}>
          <SelectValue placeholder="Выберите коллекцию" />
        </SelectTrigger>
        <SelectContent>
          {collections.map((collection) => (
            <SelectItem key={collection.id} value={collection.id}>
              {collection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function CreateEnterpriseDialog({
  open,
  onOpenChange,
  masterCollections,
  onSubmit,
}: CreateEnterpriseDialogProps) {
  const [formData, setFormData] = useState<CreateEnterpriseData>(getDefaultFormData)
  const [step, setStep] = useState<1 | 2>(1)

  const handleSubmit = () => {
    onSubmit(formData)
    setFormData(getDefaultFormData())
    setStep(1)
    onOpenChange(false)
  }
  const openMap = () => {
    const { x, y } = formData.referencePoint
    if (x && y) {
      window.open(`https://www.google.com/maps?q=${x},${y}`, "_blank", "noopener,noreferrer")
      return
    }
    if (formData.address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address)}`,
        "_blank",
        "noopener,noreferrer"
      )
    }
  }


  const updateField = (field: keyof CreateEnterpriseData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateMasterCollection = (
    key: keyof CreateEnterpriseData["masterCollections"],
    field: "enabled" | "collectionId",
    value: boolean | string
  ) => {
    setFormData((prev) => ({
      ...prev,
      masterCollections: {
        ...prev.masterCollections,
        [key]: {
          ...prev.masterCollections[key],
          [field]: value,
        },
      },
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold">Создать предприятие</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6">
          <div className="space-y-4 py-4">
            {step === 1 ? (
              <>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Полное название</Label>
              <Input
                value={formData.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Короткое название</Label>
              <Input
                value={formData.shortName}
                onChange={(e) => updateField("shortName", e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Руководитель (ФИО)</Label>
              <Input
                value={formData.director}
                onChange={(e) => updateField("director", e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Телефон</Label>
              <Input
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Имейл</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Адрес</Label>
              <Input
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">Дата создания</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="dd"
                  value={formData.createdAt.day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      createdAt: { ...prev.createdAt, day: e.target.value },
                    }))
                  }
                  className="h-9 w-16"
                />
                <Input
                  placeholder="mm"
                  value={formData.createdAt.month}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      createdAt: { ...prev.createdAt, month: e.target.value },
                    }))
                  }
                  className="h-9 w-16"
                />
                <Input
                  placeholder="year"
                  value={formData.createdAt.year}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      createdAt: { ...prev.createdAt, year: e.target.value },
                    }))
                  }
                  className="h-9 w-20"
                />
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <Label className="text-sm text-foreground pt-2">
                Опорная точка (для метеостанций)
              </Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="X"
                    value={formData.referencePoint.x}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        referencePoint: { ...prev.referencePoint, x: e.target.value },
                      }))
                    }
                    className="h-9"
                  />
                  <Input
                    placeholder="Y"
                    value={formData.referencePoint.y}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        referencePoint: { ...prev.referencePoint, y: e.target.value },
                      }))
                    }
                    className="h-9"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={openMap}
                  disabled={!formData.referencePoint.x && !formData.referencePoint.y && !formData.address}
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  На карте
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <Label className="text-sm text-foreground">Логотип</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => document.getElementById("create-logo-input")?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {formData.logo ? "Изменить" : "Загрузить"}
                </Button>
                <input
                  id="create-logo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, logo: e.target.files?.[0] }))
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-sm text-foreground">Баннер</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => document.getElementById("create-banner-input")?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {formData.banner ? "Изменить" : "Загрузить"}
                </Button>
                <input
                  id="create-banner-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, banner: e.target.files?.[0] }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Импортировать из Master Collection:
              </h3>

              <MasterCollectionRow
                label="Средства защиты растений"
                checked={formData.masterCollections.plantProtection.enabled}
                collectionId={formData.masterCollections.plantProtection.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("plantProtection", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("plantProtection", "collectionId", id)
                }
              />

              <MasterCollectionRow
                label="Удобрения"
                checked={formData.masterCollections.fertilizers.enabled}
                collectionId={formData.masterCollections.fertilizers.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("fertilizers", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("fertilizers", "collectionId", id)
                }
              />

              <MasterCollectionRow
                label="Вредители"
                checked={formData.masterCollections.pests.enabled}
                collectionId={formData.masterCollections.pests.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("pests", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("pests", "collectionId", id)
                }
              />

              <MasterCollectionRow
                label="Болезни"
                checked={formData.masterCollections.diseases.enabled}
                collectionId={formData.masterCollections.diseases.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("diseases", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("diseases", "collectionId", id)
                }
              />

              <MasterCollectionRow
                label="Сорняки"
                checked={formData.masterCollections.weeds.enabled}
                collectionId={formData.masterCollections.weeds.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("weeds", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("weeds", "collectionId", id)
                }
              />

              <MasterCollectionRow
                label="Культуры"
                checked={formData.masterCollections.cultures.enabled}
                collectionId={formData.masterCollections.cultures.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("cultures", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("cultures", "collectionId", id)
                }
              />

              <MasterCollectionRow
                label="Роли (пользователей)"
                checked={formData.masterCollections.roles.enabled}
                collectionId={formData.masterCollections.roles.collectionId}
                collections={masterCollections}
                onCheckedChange={(checked) =>
                  updateMasterCollection("roles", "enabled", checked)
                }
                onCollectionChange={(id) =>
                  updateMasterCollection("roles", "collectionId", id)
                }
              />
            </div>
              </>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Показатели предприятия</h3>

                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Общая площадь полей (га)</Label>
                  <Input value={formData.totalFieldArea} onChange={(e) => updateField("totalFieldArea", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Орошаемое/неорошаемое</Label>
                  <Input value={formData.irrigatedArea} onChange={(e) => updateField("irrigatedArea", e.target.value)} />
                  <Input value={formData.nonIrrigatedArea} onChange={(e) => updateField("nonIrrigatedArea", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Количество полей</Label>
                  <Input value={formData.fieldsCount} onChange={(e) => updateField("fieldsCount", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Производственных планов</Label>
                  <Input value={formData.productionPlansCount} onChange={(e) => updateField("productionPlansCount", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Средний размер поля (га)</Label>
                  <Input value={formData.avgFieldSize} onChange={(e) => updateField("avgFieldSize", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Количество культур</Label>
                  <Input value={formData.culturesCount} onChange={(e) => updateField("culturesCount", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Количество сотрудников</Label>
                  <Input value={formData.employeesCount} onChange={(e) => updateField("employeesCount", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Активно сейчас</Label>
                  <Input value={formData.activeNow} onChange={(e) => updateField("activeNow", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Количество машин</Label>
                  <Input value={formData.machinesCount} onChange={(e) => updateField("machinesCount", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Количество агрегатов</Label>
                  <Input value={formData.unitsCount} onChange={(e) => updateField("unitsCount", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <Label className="text-sm text-foreground">Аппаратная метеостанция (есть/нет)</Label>
                  <Checkbox
                    checked={formData.hasWeatherStation}
                    onCheckedChange={(checked) => updateField("hasWeatherStation", checked === true)}
                  />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Ожидаемый валовый сбор, KZT</Label>
                  <Input value={formData.expectedGrossYield} onChange={(e) => updateField("expectedGrossYield", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Ожидаемая валовая прибыль, KZT</Label>
                  <Input value={formData.expectedGrossProfit} onChange={(e) => updateField("expectedGrossProfit", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Рентабельность, %</Label>
                  <Input value={formData.profitability} onChange={(e) => updateField("profitability", e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_160px] items-center gap-3">
                  <Label className="text-sm text-foreground">Валовый сбор за текущий сезон, Т</Label>
                  <Input value={formData.grossYieldCurrentSeason} onChange={(e) => updateField("grossYieldCurrentSeason", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="inactive"
                checked={formData.isInactive}
                onCheckedChange={(checked) => updateField("isInactive", checked === true)}
              />
              <Label htmlFor="inactive" className="text-sm text-muted-foreground">
                Сделать неактивным
              </Label>
            </div>
            <div className="flex gap-2">
              {step === 1 ? (
                <>
                  <Button variant="outline" onClick={handleSubmit}>
                    Пропустить
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Далее
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Назад
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Создать предприятие
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
