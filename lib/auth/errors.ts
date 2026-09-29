function currentSiteHost(): string {
  if (typeof window === "undefined") return "localhost"
  return window.location.hostname
}

export function authErrorCode(err: unknown): string {
  if (!err || typeof err !== "object" || !("code" in err)) return ""
  return String((err as { code: string }).code)
}

export function mapAuthError(code: string): string {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Окно Google закрыто. Нажмите «Войти через Google» ещё раз."
    case "auth/popup-blocked":
      return "Браузер заблокировал окно Google. Разрешите всплывающие окна или попробуйте ещё раз — откроется переход на Google."
    case "auth/unauthorized-domain": {
      const host = currentSiteHost()
      return `Домен «${host}» не разрешён в Firebase. Authentication → Settings → Authorized domains — добавьте этот адрес.`
    }
    case "auth/operation-not-allowed":
      return "Вход через Google выключен. Firebase → Authentication → Sign-in method → Google → Enable."
    case "auth/account-exists-with-different-credential":
      return "Этот email уже есть в Firebase. Если в приложении вы входили через Google — нажмите «Войти через Google». Если через email — введите пароль ниже."
    case "auth/email-already-in-use":
      return "Этот email уже зарегистрирован. Нажмите «Войти» или «Войти через Google»."
    case "auth/invalid-email":
      return "Некорректный email."
    case "auth/weak-password":
      return "Пароль слишком короткий (минимум 6 символов)."
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Неверный email или пароль. Если в приложении вход через Google — пароль не нужен, нажмите «Войти через Google»."
    case "auth/too-many-requests":
      return "Слишком много попыток. Подождите немного."
    case "auth/network-request-failed":
      return "Нет сети. Проверьте интернет и попробуйте снова."
    default:
      return "Не удалось войти. Если аккаунт из приложения — используйте «Войти через Google»."
  }
}
