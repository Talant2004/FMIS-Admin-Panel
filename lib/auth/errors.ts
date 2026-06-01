function currentSiteHost(): string {
  if (typeof window === "undefined") return "localhost"
  return window.location.hostname
}

export function mapAuthError(code: string): string {
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Окно входа закрыто. Попробуйте ещё раз."
    case "auth/unauthorized-domain": {
      const host = currentSiteHost()
      return `Домен «${host}» не в списке Firebase (Authorized domains). Для входа по email это обычно не нужно — используйте форму ниже.`
    }
    case "auth/operation-not-allowed":
      return "Этот способ входа выключен в Firebase (Authentication → Sign-in method)."
    case "auth/email-already-in-use":
      return "Этот email уже зарегистрирован. Нажмите «Войти»."
    case "auth/invalid-email":
      return "Некорректный email."
    case "auth/weak-password":
      return "Пароль слишком короткий (минимум 6 символов)."
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Неверный email или пароль."
    case "auth/too-many-requests":
      return "Слишком много попыток. Подождите немного."
    default:
      return "Не удалось выполнить вход. Проверьте email и пароль."
  }
}
