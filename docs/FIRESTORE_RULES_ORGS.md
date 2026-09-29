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
| `inspector` | только `userId == auth.uid` в своей org | свой профиль |

## Миграция

До backfill `organizationId` на старых пробах: пробы без поля читаются только пользователями org `kazniizirk` (см. `legacyKazniizirkSample`).

После миграции (`npm run migrate:orgs`) правило legacy можно убрать.
