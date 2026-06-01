FMIS Admin Panel — бэкап Firestore
================================

Файл: enterprises.json
Проект: fmis-admin-panel
Коллекция: enterprises
Записей: 7
Дата: 2026-06-01T09:40:39.432Z

Как переключить сайт на базу журнала (default):
  1. Firebase Console → проект журнала → Project settings → Web app → config
  2. Скопируйте data/firestore-backup/journal.env.example → journal.env
  3. Вставьте ключи в journal.env
  4. npm run migrate:journal

Или скажите ассистенту: «вот config журнала» — он заполнит и запустит.

Как восстановить только данные (без смены .env):
  npm run backup:import

Примечание:
  - geojson уже в виде объекта (не строка)
  - URL файлов (logo, banner и т.д.) указывают на старый Storage bucket
  - после смены проекта файлы нужно перезалить или скопировать Storage
