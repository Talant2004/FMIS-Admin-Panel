# Схема проб (Firestore `samples`)

Один документ = одна проба. Тип: поле `monitoringType`.

| monitoringType   | Роль          | Основные поля                          |
|------------------|---------------|----------------------------------------|
| `entomology`     | Энтомолог     | pest, sampleValues, thresholdExceeded  |
| `phytopathology` | Фитопатолог   | disease1–3, prevalencePercentage…      |
| `herbology`      | Герболог      | weed1–3, weedPrevalence…               |

Общие: `userId`, `userEmail`, `fullName`, `createdAt`, `farmingName`, `crop`, `lat`/`lng`, `rowCoordinates`, `weatherConditions`, `photoUrls`.

Сайт читает эту схему в `lib/journal/probe-parse.ts`.
