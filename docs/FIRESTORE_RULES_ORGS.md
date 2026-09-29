# Firestore Rules — мульти-организации

Файл правил в репозитории: [`firestore.rules`](../firestore.rules)

## Публикация

1. Firebase Console → **Firestore** → **Rules**
2. Вставьте содержимое `firestore.rules` (или `firebase deploy --only firestore:rules`, если настроен `firebase.json`)
3. Добавьте свои admin-email в `isPlatformAdmin()` (массив `request.auth.token.email in [...]`)
4. Синхронизируйте список с `NEXT_PUBLIC_ADMIN_EMAILS` в Vercel

## Роли

| role | samples read | users read |
|------|--------------|------------|
| `platform_admin` | все | все |
| `org_admin` | все пробы своей `organizationId` | users своей org |
| `inspector` | свои пробы + пробы **принятых** напарников (`inspector_teams` status accepted) | каталог `users` |

Команда: коллекция `inspector_teams`, id = `minUid_maxUid`. См. [MOBILE_TEAM_INVITES.md](MOBILE_TEAM_INVITES.md).

## Миграция

До backfill `organizationId` на старых пробах: пробы без поля читаются только пользователями org `kazniizirk` (см. `legacyKazniizirkSample`).

После миграции (`npm run migrate:orgs`) правило legacy можно убрать.
