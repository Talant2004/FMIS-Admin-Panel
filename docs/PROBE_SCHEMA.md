# Схема проб (Firestore `samples`)

Один документ = одна проба. Тип: поле `monitoringType`.

| monitoringType   | Роль          | Основные поля                          |
|------------------|---------------|----------------------------------------|
| `entomology`     | Энтомолог     | pest, sampleValues, thresholdExceeded  |
| `phytopathology` | Фитопатолог   | disease1–3, prevalencePercentage…      |
| `herbology`      | Герболог      | weed1–3, weedPrevalence…               |

Общие: `userId`, `userEmail`, `fullName`, `createdAt`, `farmingName`, `crop`, `lat`/`lng`, `rowCoordinates`, `weatherConditions`, `photoUrls`.

**Организация (обязательно для новых проб):**

| Поле | Описание |
|------|----------|
| `organizationId` | ID компании из коллекции `organizations` |
| `farmingName` | Название хозяйства / компании (может дублировать имя org) |

Сайт читает эту схему в `lib/journal/probe-parse.ts`.

## Профиль пользователя (`users/{uid}`)

| Поле | Описание |
|------|----------|
| `organizationId` | Компания пользователя |
| `role` | `platform_admin` \| `org_admin` \| `inspector` |
| `email`, `displayName` | Контакты |

## Мобильное приложение (Flutter)

1. После входа загрузить `users/{uid}` → `organizationId`, `displayName`.
2. При сохранении пробы **всегда** записывать `organizationId` из профиля (не только `farmingName`).
3. `userId` = `auth.uid`, `userEmail` = email из Auth.

Подробнее: [docs/MOBILE_ORGANIZATION.md](MOBILE_ORGANIZATION.md).

## Почвенные показатели на сайте

Для карточки пробы сайт дополнительно подтягивает почвенные индикаторы по координате:

- pH (`phh2o`)
- органический углерод (`soc`)
- слой: `0-5 см`

Источник: **ISRIC SoilGrids v2.0** через API  
`https://rest.isric.org/soilgrids/v2.0/properties/query`
