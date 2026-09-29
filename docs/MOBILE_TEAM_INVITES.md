# ТЗ: приглашения в команду (мобильное приложение FMIS)

Версия для Flutter. Сайт уже пишет и читает ту же коллекцию Firestore.

Цель: инспектор видит **каталог коллег** как портфолио (без чужих проб). Журнал и прогноз коллеги открываются **только после взаимного согласия**. Согласие даётся в приложении. Удаление из команды сразу закрывает доступ **у обоих**.

---

## 1. Правила поведения

| Событие | Результат |
|---------|-----------|
| А отправил приглашение Б | Статус `pending`. У Б — входящее. У А — «ожидает согласия». Журналы **не** открыты. |
| Б принял | Статус `accepted`. **Оба** видят пробы друг друга в журнале и прогнозе. |
| Б отклонил **или** любой удалил связь | Документ **удаляется**. Доступ пропадает сразу у обоих. Повтор — новое приглашение. |
| Встречные приглашения | Если Б уже отправил А, а А жмёт «пригласить» — считать согласием (`accepted`). |

Админы компании (`org_admin`, `platform_admin`) **не** используют эту схему: они видят данные организации целиком.

---

## 2. Коллекция `inspector_teams`

**ID документа** (обязательно так, иначе rules отклонят create):

```
pairId = uidA < uidB ? '${uidA}_${uidB}' : '${uidB}_${uidA}'
```

Поля:

| Поле | Тип | Описание |
|------|-----|----------|
| `userA` | string | min(from, to) |
| `userB` | string | max(from, to) |
| `fromUserId` | string | кто отправил = `auth.uid` |
| `toUserId` | string | кого пригласили |
| `fromName` | string | ФИО/email отправителя |
| `toName` | string | ФИО/email получателя |
| `fromOrganizationId` | string? | org отправителя |
| `toOrganizationId` | string? | org получателя |
| `status` | `pending` \| `accepted` | |
| `createdAt` | string ISO | |
| `respondedAt` | string ISO? | при accept |

Нельзя пригласить себя. Один документ на пару людей.

---

## 3. Экраны в приложении

### 3.1. «Приглашения» (обязательно)

После входа слушайте (snapshots):

- `inspector_teams` where `toUserId == currentUid` and `status == pending`

Для каждого: имя `fromName`, кнопки **Принять** / **Отклонить**.

**Принять:**

```dart
await doc.reference.update({
  'status': 'accepted',
  'respondedAt': DateTime.now().toUtc().toIso8601String(),
});
```

Менять можно только `pending → accepted`, и только если `toUserId == auth.uid`.

**Отклонить:** `await doc.reference.delete();`

Badge на иконке = число входящих `pending`.

Push (желательно): при create с `toUserId == этот пользователь`.

### 3.2. Каталог инспекторов (как на сайте)

Чтение `users` (для авторизованных открыто). Карточка: имя, дисциплина, организация. **Не** показывать чужие пробы, пороги, фото, координаты.

Кнопки как на сайте:

- нет связи → **Пригласить в команду**
- `pending` и вы отправитель → «Ожидает согласия»
- `pending` и вы получатель → вести на экран приглашений
- `accepted` → метка **Ваша команда** + **Удалить из команды** (`delete` документа)

**Создать приглашение:**

```dart
final pairId = uidA.compareTo(uidB) < 0 ? '${uidA}_$uidB' : '${uidB}_$uidA';
await FirebaseFirestore.instance.collection('inspector_teams').doc(pairId).set({
  'userA': uidA.compareTo(uidB) < 0 ? uidA : uidB,
  'userB': uidA.compareTo(uidB) < 0 ? uidB : uidA,
  'fromUserId': myUid,
  'toUserId': otherUid,
  'fromName': myName,
  'toName': otherName,
  'fromOrganizationId': myOrgId,
  'toOrganizationId': otherOrgId,
  'status': 'pending',
  'createdAt': DateTime.now().toUtc().toIso8601String(),
});
```

Если документ уже `accepted` — не создавать. Если `pending` и `toUserId == я` — вместо set сделать **accept**.

### 3.3. Журнал в приложении

- **Мой журнал** — `samples` where `userId == auth.uid`
- **Журнал команды** — `userId` in `[я, ...acceptedTeammates]` (пачки по 10 для `whereIn`)

Список принятых напарников:

```
status == accepted AND (fromUserId == я OR toUserId == я)
otherUid = from == я ? to : from
```

Правила разрешают читать пробу коллеги **только** если есть `accepted` на паре uid.

Прогноз строить по тем же точкам, что журнал команды.

---

## 4. Что не делать

- Не открывать все `samples` организации инспектору без команды.
- Не менять `fromUserId` / `toUserId` при accept.
- Не использовать другой id документа, кроме `pairId`.
- Не хранить «односторонний» доступ: после accept всегда оба.

---

## 5. Согласование с сайтом

Сайт: страница **Инспекторы** (приглашение), **Журнал** (команда), **Мой журнал** (только свои).

Приложение: **обязательный** экран принятия, иначе приглашения с сайта «зависнут».

После публикации новых Firestore Rules в Console — проверить create/update/delete `inspector_teams` под тестовым инспектором.
