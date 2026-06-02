# Схема проб (Firestore `samples`)

Один документ = одна проба. Тип: поле `monitoringType`.

| monitoringType   | Роль          | Основные поля                          |
|------------------|---------------|----------------------------------------|
| `entomology`     | Энтомолог     | pest, sampleValues, thresholdExceeded  |
| `phytopathology` | Фитопатолог   | disease1–3, prevalencePercentage…      |
| `herbology`      | Герболог      | weed1–3, weedPrevalence…               |

Общие: `userId`, `userEmail`, `fullName`, `createdAt`, `farmingName`, `crop`, `lat`/`lng`, `rowCoordinates`, `weatherConditions`, `photoUrls`.

Сайт читает эту схему в `lib/journal/probe-parse.ts`.

## Почвенные показатели на сайте

Для карточки пробы сайт дополнительно подтягивает почвенные индикаторы по координате:

- pH (`phh2o`)
- органический углерод (`soc`)
- слой: `0-5 см`

Источник: **ISRIC SoilGrids v2.0** через API  
`https://rest.isric.org/soilgrids/v2.0/properties/query`
