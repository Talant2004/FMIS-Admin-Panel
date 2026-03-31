"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { getEnterprises } from "@/lib/firestore-enterprises"
import { mockEnterprises } from "@/lib/mock-data"
import type { Enterprise } from "@/lib/types"

function TableHeadCell({ label }: { label: string }) {
  return <th className="whitespace-nowrap border px-2 py-1 text-left">{label}</th>
}

function TableCell({ value }: { value: string | number | boolean }) {
  return <td className="whitespace-nowrap border px-2 py-1 text-xs">{String(value)}</td>
}

function LinkCell({ url }: { url?: string }) {
  if (!url) return <td className="whitespace-nowrap border px-2 py-1 text-xs text-muted-foreground">-</td>

  return (
    <td className="whitespace-nowrap border px-2 py-1 text-xs">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-green-700 underline underline-offset-4 hover:text-green-800"
      >
        Открыть
      </a>
    </td>
  )
}

export default function DashboardPage() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const data = await getEnterprises()
        if (!isMounted) return
        setEnterprises(data.length ? data : mockEnterprises)
      } catch {
        if (!isMounted) return
        setEnterprises(mockEnterprises)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      <div className="p-4">
        <h1 className="mb-3 text-sm font-semibold">
          Таблица предприятий {isLoading ? "(загрузка...)" : `(${enterprises.length})`}
        </h1>

        <div className="overflow-auto rounded-md border">
          <table className="min-w-max border-collapse">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <TableHeadCell label="ID" />
                <TableHeadCell label="Название" />
                <TableHeadCell label="Короткое название" />
                <TableHeadCell label="Директор" />
                <TableHeadCell label="Телефон" />
                <TableHeadCell label="Email" />
                <TableHeadCell label="Адрес" />
                <TableHeadCell label="IBAN" />
                <TableHeadCell label="Дата создания" />
                <TableHeadCell label="X" />
                <TableHeadCell label="Y" />
                <TableHeadCell label="Теги" />
                <TableHeadCell label="Активно" />
                <TableHeadCell label="Общая площадь полей" />
                <TableHeadCell label="Орошаемое" />
                <TableHeadCell label="Неорошаемое" />
                <TableHeadCell label="Количество полей" />
                <TableHeadCell label="Производственных планов" />
                <TableHeadCell label="Средний размер поля" />
                <TableHeadCell label="Количество культур" />
                <TableHeadCell label="Количество сотрудников" />
                <TableHeadCell label="Активно сейчас" />
                <TableHeadCell label="Количество машин" />
                <TableHeadCell label="Количество агрегатов" />
                <TableHeadCell label="Метеостанция" />
                <TableHeadCell label="Ожидаемый валовый сбор" />
                <TableHeadCell label="Ожидаемая валовая прибыль" />
                <TableHeadCell label="Рентабельность" />
                <TableHeadCell label="Валовый сбор текущий сезон" />
                <TableHeadCell label="Логотип URL" />
                <TableHeadCell label="Фавикон URL" />
                <TableHeadCell label="Баннер URL" />
                <TableHeadCell label="Обложка URL" />
              </tr>
            </thead>
            <tbody>
              {enterprises.map((e) => (
                <tr key={e.id}>
                  <TableCell value={e.id} />
                  <TableCell value={e.name} />
                  <TableCell value={e.shortName} />
                  <TableCell value={e.director} />
                  <TableCell value={e.phone} />
                  <TableCell value={e.email} />
                  <TableCell value={e.address} />
                  <TableCell value={e.iban} />
                  <TableCell value={e.createdAt} />
                  <TableCell value={e.referencePoint.x} />
                  <TableCell value={e.referencePoint.y} />
                  <TableCell value={e.tags.join(", ")} />
                  <TableCell value={e.isActive ? "да" : "нет"} />
                  <TableCell value={e.totalFieldArea} />
                  <TableCell value={e.irrigatedArea} />
                  <TableCell value={e.nonIrrigatedArea} />
                  <TableCell value={e.fieldsCount} />
                  <TableCell value={e.productionPlansCount} />
                  <TableCell value={e.avgFieldSize} />
                  <TableCell value={e.culturesCount} />
                  <TableCell value={e.employeesCount} />
                  <TableCell value={e.activeNow} />
                  <TableCell value={e.machinesCount} />
                  <TableCell value={e.unitsCount} />
                  <TableCell value={e.hasWeatherStation ? "да" : "нет"} />
                  <TableCell value={e.expectedGrossYield} />
                  <TableCell value={e.expectedGrossProfit} />
                  <TableCell value={e.profitability} />
                  <TableCell value={e.grossYieldCurrentSeason} />
                  <LinkCell url={e.logo} />
                  <LinkCell url={e.favicon} />
                  <LinkCell url={e.banner} />
                  <LinkCell url={e.appCover} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
