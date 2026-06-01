"use client"

import { getAdminEmails } from "@/lib/auth/admin"

export function AdminAccessCard({ isAdmin, userEmail }: { isAdmin: boolean; userEmail?: string | null }) {
  const adminEmails = getAdminEmails()

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 text-sm">
      <div>
        <p className="font-medium">Режим доступа</p>
        {isAdmin ? (
          <p className="mt-1 text-emerald-600">Администратор — виден весь полевой журнал</p>
        ) : (
          <p className="mt-1 text-muted-foreground">
            Сейчас: обычный пользователь
            {userEmail ? ` (${userEmail})` : ""}. Видны только ваши осмотры.
          </p>
        )}
      </div>

      {!isAdmin ? (
        <div className="space-y-3 border-t pt-4 text-muted-foreground">
          <p className="font-medium text-foreground">Как войти как администратор</p>
          <ol className="list-decimal space-y-2 pl-4">
            <li>
              Зарегистрируйтесь или войдите с email, который добавите в Firebase (не обязательно Google).
            </li>
            <li>
              Firebase Console → проект <strong>polevoitest</strong> → Firestore → <strong>Rules</strong> — в
              функцию <code className="text-xs">isAdmin()</code> добавьте ваш email:
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs text-foreground">{`function isAdmin() {
  return request.auth != null &&
    request.auth.token.email in [
      'admin@greenzone.app',
      'ваш@email.com'
    ];
}`}</pre>
            </li>
            <li>Нажмите <strong>Publish</strong>, выйдите на сайте и войдите снова с этим email.</li>
            <li>
              (Опционально) На Vercel: <code className="text-xs">NEXT_PUBLIC_ADMIN_EMAILS</code> = тот же
              email через запятую — тогда в интерфейсе будет подпись «Администратор».
            </li>
          </ol>
        </div>
      ) : null}

      <div className="border-t pt-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Админы в настройках сайта</p>
        <p className="mt-1 font-mono">{adminEmails.join(", ")}</p>
      </div>
    </div>
  )
}
