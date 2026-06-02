# ТЗ: Аналитика, Прогноз, Firebase

Полный текст постановки — в задаче заказчика. Ниже — статус реализации в репозитории.

## Статус

| Блок | Пункт | Статус |
|------|--------|--------|
| 1 | СЭТ по архиву погоды | Реализовано (`lib/analytics/set.ts`, карточка на `/analytics`) |
| 1 | ИФН (спидометр) | Реализовано (`lib/analytics/ifn.ts`, `IfnGauge`) |
| 1 | QC инспекции (время, гео) | Реализовано (`QcSummaryCard`, `lib/analytics/qc.ts`) |
| 1 | СЭТ по хозяйству/культуре | Реализовано (фильтры + `resolveVegetationStart`) |
| 2 | Почасовой прогноз 7 суток | Реализовано (`forecast_days=7`, ~168 ч) |
| 1 | Heatmap объекты × недели (1–52) | Реализовано (`YearEpvHeatmap`) |
| 1 | Погода vs угрозы + Brush | Реализовано (`WeatherThreatChart`) |
| 2 | Кластеры 5–10 км + предприятие | Реализовано (`lib/journal/field-clusters.ts`) |
| 2 | Rule-engine (ржавчина и др.) | Реализовано (`lib/forecast/predictRules.ts`) |
| 2 | Окно опрыскивания | Реализовано (`SprayWindowCard`, `/api/weather/hourly`) |
| 3.1 | Пагинация журнала 50 + cursor | Реализовано (`lib/journal/paginated-samples.ts`) |
| 3.2 | `daily_summaries` + Cloud Function | Реализовано (`functions/`, чтение с fallback на `samples`) |

## Деплой Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:aggregateDailySummaries
```

Требуется Firebase CLI и проект с Firestore. После первого деплоя — дождаться ночного запуска или вызвать функцию вручную из консоли.

## Индексы Firestore

Для пагинации с фильтром может понадобиться составной индекс:

- `samples`: `monitoringType` + `date` (desc)

Firebase предложит ссылку при первой ошибке запроса.
