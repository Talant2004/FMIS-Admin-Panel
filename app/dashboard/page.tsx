"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { getEnterprises } from "@/lib/firestore-enterprises"
import type { Enterprise } from "@/lib/types"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import {
  Building2,
  Layers,
  Users,
  Tractor,
  TrendingUp,
  CloudSun,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Wheat,
  BarChart3,
  Map,
  BookOpen,
} from "lucide-react"
import Link from "next/link"

/* ──────────────────────────── helpers ──────────────────────────── */

function fmt(n: number, digits = 0) {
  if (!n && n !== 0) return "—"
  return n.toLocaleString("ru-RU", { maximumFractionDigits: digits })
}

function shortName(e: Enterprise) {
  return e.shortName || e.name.split(" ").slice(0, 2).join(" ")
}

/* ──────────────────────────── KPI card ──────────────────────────── */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-foreground",
  accent = "bg-muted/60",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
  accent?: string
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-border ${accent} p-4`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
        <Icon size={14} />
        {label}
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

/* ──────────────────────────── sort helpers ──────────────────────── */

type SortKey = keyof Enterprise
type SortDir = "asc" | "desc"

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="opacity-40" />
  return dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

/* ──────────────────────────── custom tooltip ─────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

/* ──────────────────────────── page ──────────────────────────── */

const CHART_COLORS = {
  irrigated: "#22c55e",
  nonIrrigated: "#f97316",
  employees: "#3b82f6",
  active: "#6366f1",
  profit: "#10b981",
  loss: "#ef4444",
}

export default function DashboardPage() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("totalFieldArea")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [search, setSearch] = useState("")

  useEffect(() => {
    let isMounted = true
    getEnterprises()
      .then((data) => { if (isMounted) { setEnterprises(data); setLoadError(null) } })
      .catch((err) => { if (isMounted) setLoadError(err instanceof Error ? err.message : "Неизвестная ошибка") })
      .finally(() => { if (isMounted) setIsLoading(false) })
    return () => { isMounted = false }
  }, [])

  /* ── KPIs ── */
  const kpi = useMemo(() => {
    const active = enterprises.filter((e) => e.isActive)
    const totalArea = enterprises.reduce((s, e) => s + (e.totalFieldArea || 0), 0)
    const irrigated = enterprises.reduce((s, e) => s + (e.irrigatedArea || 0), 0)
    const employees = enterprises.reduce((s, e) => s + (e.employeesCount || 0), 0)
    const machines = enterprises.reduce((s, e) => s + (e.machinesCount || 0) + (e.unitsCount || 0), 0)
    const avgProfit = enterprises.length
      ? enterprises.reduce((s, e) => s + (e.profitability || 0), 0) / enterprises.length
      : 0
    const withStation = enterprises.filter((e) => e.hasWeatherStation).length
    const fields = enterprises.reduce((s, e) => s + (e.fieldsCount || 0), 0)
    return { active, totalArea, irrigated, employees, machines, avgProfit, withStation, fields }
  }, [enterprises])

  /* ── area chart ── */
  const areaData = useMemo(
    () =>
      [...enterprises]
        .sort((a, b) => (b.totalFieldArea || 0) - (a.totalFieldArea || 0))
        .slice(0, 12)
        .map((e) => ({
          name: shortName(e),
          Орошаемое: e.irrigatedArea || 0,
          Неорошаемое: e.nonIrrigatedArea || 0,
        })),
    [enterprises]
  )

  /* ── staff chart ── */
  const staffData = useMemo(
    () =>
      [...enterprises]
        .sort((a, b) => (b.employeesCount || 0) - (a.employeesCount || 0))
        .slice(0, 12)
        .map((e) => ({
          name: shortName(e),
          Сотрудники: e.employeesCount || 0,
          "Сейчас на объекте": e.activeNow || 0,
        })),
    [enterprises]
  )

  /* ── profitability chart ── */
  const profitData = useMemo(
    () =>
      [...enterprises]
        .filter((e) => e.profitability)
        .sort((a, b) => (b.profitability || 0) - (a.profitability || 0))
        .slice(0, 12)
        .map((e) => ({
          name: shortName(e),
          value: e.profitability || 0,
        })),
    [enterprises]
  )

  /* ── active/inactive pie ── */
  const pieData = useMemo(
    () => [
      { name: "Активные", value: kpi.active.length, fill: "#22c55e" },
      { name: "Неактивные", value: enterprises.length - kpi.active.length, fill: "#e5e7eb" },
    ],
    [kpi.active.length, enterprises.length]
  )

  /* ── sortable table ── */
  const tableData = useMemo(() => {
    const filtered = enterprises.filter(
      (e) =>
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.director.toLowerCase().includes(search.toLowerCase()) ||
        e.address.toLowerCase().includes(search.toLowerCase())
    )
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "ru")
        : String(bv).localeCompare(String(av), "ru")
    })
  }, [enterprises, search, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const TH = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortKey={sortKey} dir={sortDir} />
      </span>
    </th>
  )

  /* ─────────────── quick links ─────────────── */
  const quickLinks = [
    { label: "Предприятия", href: "/", icon: Building2, desc: "CRUD управление" },
    { label: "Карта полей", href: "/map", icon: Map, desc: "GeoJSON границы полей" },
    { label: "Полевой журнал", href: "/journal", icon: BookOpen, desc: "Записи инспекторов" },
    { label: "Аналитика", href: "/analytics", icon: BarChart3, desc: "Графики и экспорт" },
  ]

  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-8">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Обзор предприятий</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Загрузка…"
                : `${enterprises.length} предприятий · данные из Firestore`}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            + Добавить предприятие
          </Link>
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Ошибка Firestore: {loadError}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            icon={Building2}
            label="Предприятий"
            value={isLoading ? "…" : enterprises.length}
            sub={`${kpi.active.length} активных`}
            accent="bg-indigo-50 dark:bg-indigo-950/30"
            color="text-indigo-600 dark:text-indigo-400"
          />
          <KpiCard
            icon={Layers}
            label="Площадь, га"
            value={isLoading ? "…" : fmt(kpi.totalArea)}
            sub={`орошаемое: ${fmt(kpi.irrigated)} га`}
            accent="bg-green-50 dark:bg-green-950/30"
            color="text-green-700 dark:text-green-400"
          />
          <KpiCard
            icon={Wheat}
            label="Полей"
            value={isLoading ? "…" : fmt(kpi.fields)}
            sub="по всем предприятиям"
            accent="bg-amber-50 dark:bg-amber-950/30"
            color="text-amber-700 dark:text-amber-400"
          />
          <KpiCard
            icon={Users}
            label="Сотрудников"
            value={isLoading ? "…" : fmt(kpi.employees)}
            sub="в штате"
            accent="bg-blue-50 dark:bg-blue-950/30"
            color="text-blue-700 dark:text-blue-400"
          />
          <KpiCard
            icon={Tractor}
            label="Техника"
            value={isLoading ? "…" : fmt(kpi.machines)}
            sub="машины + агрегаты"
            accent="bg-orange-50 dark:bg-orange-950/30"
            color="text-orange-700 dark:text-orange-400"
          />
          <KpiCard
            icon={TrendingUp}
            label="Ср. рентабельность"
            value={isLoading ? "…" : `${fmt(kpi.avgProfit, 1)}%`}
            sub={`метеостанции: ${kpi.withStation}`}
            accent="bg-emerald-50 dark:bg-emerald-950/30"
            color={kpi.avgProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}
          />
        </div>

        {/* quick links */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickLinks.map((ql) => (
            <Link
              key={ql.href}
              href={ql.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 hover:bg-muted transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border group-hover:border-primary/30 transition-colors">
                <ql.icon size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <div className="text-sm font-medium">{ql.label}</div>
                <div className="text-xs text-muted-foreground">{ql.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* charts row 1: area + active pie */}
        {!isLoading && enterprises.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* area bar chart */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold">Площади полей, га (топ-12)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={areaData} margin={{ top: 0, right: 0, left: 0, bottom: 50 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={50} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Орошаемое" stackId="a" fill={CHART_COLORS.irrigated} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Неорошаемое" stackId="a" fill={CHART_COLORS.nonIrrigated} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* active pie */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
              <h2 className="mb-4 text-sm font-semibold">Статус предприятий</h2>
              <div className="flex-1 flex items-center justify-center">
                <PieChart width={200} height={200}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} предпр.`]} />
                </PieChart>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                      {d.name}
                    </span>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* charts row 2: staff + profitability */}
        {!isLoading && enterprises.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* staff */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold">Сотрудники (топ-12)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={staffData} margin={{ top: 0, right: 0, left: 0, bottom: 50 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Сотрудники" fill={CHART_COLORS.employees} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Сейчас на объекте" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* profitability */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold">Рентабельность, % (топ-12)</h2>
              {profitData.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                  Данные о рентабельности не заполнены
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={profitData} margin={{ top: 0, right: 0, left: 0, bottom: 50 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={35} unit="%" />
                    <Tooltip formatter={(v: number) => [`${fmt(v, 1)}%`, "Рентабельность"]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {profitData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.value >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* sortable table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Все предприятия</h2>
            <input
              type="search"
              placeholder="Поиск по названию, директору, адресу…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 w-64"
            />
          </div>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <TH label="Название" col="name" />
                  <TH label="Директор" col="director" />
                  <TH label="Площадь, га" col="totalFieldArea" />
                  <TH label="Орошаемое" col="irrigatedArea" />
                  <TH label="Полей" col="fieldsCount" />
                  <TH label="Культур" col="culturesCount" />
                  <TH label="Сотрудников" col="employeesCount" />
                  <TH label="Техника" col="machinesCount" />
                  <TH label="Рентабельность" col="profitability" />
                  <TH label="Урожай (план)" col="expectedGrossYield" />
                  <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                    Статус
                  </th>
                  <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                    Метео
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : tableData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Ничего не найдено
                    </td>
                  </tr>
                ) : (
                  tableData.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.address}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{e.director || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(e.totalFieldArea)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                        {fmt(e.irrigatedArea)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(e.fieldsCount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(e.culturesCount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(e.employeesCount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt((e.machinesCount || 0) + (e.unitsCount || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span
                          className={
                            (e.profitability || 0) >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-600"
                          }
                        >
                          {e.profitability ? `${fmt(e.profitability, 1)}%` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(e.expectedGrossYield)}
                      </td>
                      <td className="px-3 py-2">
                        {e.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 size={10} />
                            Активно
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            <XCircle size={10} />
                            Неактивно
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {e.hasWeatherStation ? (
                          <CloudSun size={14} className="text-blue-500" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && tableData.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {tableData.length} из {enterprises.length} предприятий · нажмите на заголовок столбца для сортировки
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
