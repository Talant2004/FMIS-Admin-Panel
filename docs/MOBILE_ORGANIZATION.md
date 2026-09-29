# Мобильное приложение — привязка проб к организации

## После входа (Firebase Auth)

1. Загрузите документ **`users/{uid}`** из Firestore.
2. Сохраните в локальном состоянии сессии:
   - `organizationId` (обязательно)
   - `role` (`inspector` | `org_admin` | `platform_admin`)
   - `displayName`, `email`

Если документа нет — пользователь не может создавать пробы (покажите ошибку «Обратитесь к администратору компании»).

## Создание пробы (`samples`)

При каждой записи добавляйте поля:

| Поле | Значение |
|------|----------|
| `userId` | `FirebaseAuth.instance.currentUser!.uid` |
| `userEmail` | email из Auth |
| `organizationId` | из профиля `users/{uid}` |
| `farmingName` | название компании (из `organizations/{organizationId}.name` или кэша) |

Остальные поля — как в [PROBE_SCHEMA.md](PROBE_SCHEMA.md).

## Пример (Dart / псевдокод)

```dart
final uid = FirebaseAuth.instance.currentUser!.uid;
final userDoc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
final orgId = userDoc.data()?['organizationId'] as String?;
if (orgId == null || orgId.isEmpty) throw Exception('organizationId missing');

await FirebaseFirestore.instance.collection('samples').add({
  'userId': uid,
  'organizationId': orgId,
  'farmingName': organizationName,
  'monitoringType': 'entomology',
  // ...
});
```

## Правила Firestore

Клиент может создать пробу только если `organizationId` в документе совпадает с `users/{uid}.organizationId`. См. [FIRESTORE_RULES_ORGS.md](FIRESTORE_RULES_ORGS.md).

## Аккаунты инспекторов

Администратор компании создаёт email/пароль на странице **Инспекторы** в веб-панели. Инспектор входит в приложение тем же email/паролем (Email/Password в Firebase Auth).

## Команда инспекторов

Приглашение и согласие: [MOBILE_TEAM_INVITES.md](MOBILE_TEAM_INVITES.md).

