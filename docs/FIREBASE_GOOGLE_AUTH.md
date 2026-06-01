# Вход в панель (полевой журнал)

## Firebase Console — Email/Password (рекомендуется)

1. **Authentication** → **Sign-in method** → **Email/Password** → **Enable** → Save.
2. Регистрация на сайте: вкладка **Регистрация** → email + пароль (минимум 6 символов).

Домены Authorized domains для email/password **обычно не мешают** — в отличие от Google.

## Google (опционально)

1. **Authentication** → **Sign-in method** → включите **Google** → Save.
2. **Authentication** → **Settings** → **Authorized domains** — добавьте:
   - `localhost`
   - `fmis-admin-panel.vercel.app`
   - ваш кастомный домен, если есть.

## Firestore Rules (polevoitest)

Сайт отправляет токен после входа. Для чтения **всех** `samples` и `users` email должен проходить `isAdmin()`:

```javascript
function isAdmin() {
  return request.auth != null &&
    request.auth.token.email in [
      'admin@greenzone.app',
      'ваш@gmail.com'
    ];
}
```

Либо добавьте свой Gmail в список и опубликуйте Rules.

Обычный пользователь Google видит только **свои** записи (`userId == auth.uid`).

## Переменные окружения

```env
NEXT_PUBLIC_ADMIN_EMAILS=admin@greenzone.app,ваш@gmail.com
```

На Vercel — те же переменные в **Settings → Environment Variables**.
