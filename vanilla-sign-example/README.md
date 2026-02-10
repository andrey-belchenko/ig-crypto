# Vanilla Sign Example

Минимальный пример подписания файлов с использованием CryptoPro Browser Plugin без React.

## Две версии реализации

### 1. Async версия (`index.html` + `app.js`)
- Использует асинхронный API через `nmcades_plugin_api.js`
- Использует `cadesplugin.async_spawn()` для асинхронных операций
- Подписание через `SignCades()` с передачей содержимого файла
- Выбор сертификата по thumbprint

### 2. Hash-based версия (`index-hash.html` + `app-hash.js`)
- Использует синхронный API через `cadesplugin_api.js`
- Использует `CAdESCOM.HashedData` для хеширования файла по частям (3MB)
- Подписание через `SignHash()` с передачей хеша
- Выбор сертификата по Subject Name
- Поддержка больших файлов через чтение по частям
- Включает проверку подписи после создания

## Требования

1. Установленный CryptoPro Browser Plugin в браузере
2. Сертификат с закрытым ключом в хранилище Windows
3. HTTP сервер для запуска (нельзя открывать через file://)

## Как запустить

### Вариант 1: Python HTTP Server

Если у вас установлен Python:

```bash
# Python 3
cd vanilla-sign-example
python -m http.server 8000

# Или Python 2
python -m SimpleHTTPServer 8000
```

Затем откройте в браузере:
- Async версия: `http://localhost:8000/index.html`
- Hash-based версия: `http://localhost:8000/index-hash.html`

### Вариант 2: Node.js http-server

Если у вас установлен Node.js:

```bash
# Установите http-server глобально (один раз)
npm install -g http-server

# Запустите сервер
cd vanilla-sign-example
http-server -p 8000
```

Затем откройте в браузере:
- Async версия: `http://localhost:8000/index.html`
- Hash-based версия: `http://localhost:8000/index-hash.html`

### Вариант 3: VS Code Live Server

Если вы используете VS Code:

1. Установите расширение "Live Server"
2. Правый клик на `index.html` или `index-hash.html` → "Open with Live Server"

### Вариант 4: Другие серверы

Любой другой HTTP сервер подойдет, например:
- PHP: `php -S localhost:8000`
- Ruby: `ruby -run -e httpd . -p 8000`

## Использование

### Async версия (`index.html`)

1. Откройте `index.html` в браузере (Chrome/Edge с установленным CryptoPro плагином)
2. Нажмите "Активировать плагин"
3. Выберите сертификат из списка
4. Выберите файл для подписания
5. Нажмите "Подписать файл"
6. Файл подписи `.sig` будет автоматически скачан

### Hash-based версия (`index-hash.html`)

1. Откройте `index-hash.html` в браузере
2. Нажмите "Активировать плагин"
3. Выберите сертификат из списка или введите Subject Name вручную
4. Выберите файл для подписания (поддерживаются большие файлы)
5. Нажмите "Подписать файл"
6. Отслеживайте прогресс хеширования файла
7. Файл подписи `.sig` будет автоматически скачан
8. Подпись автоматически проверяется после создания

## Различия между версиями

| Характеристика | Async версия | Hash-based версия |
|----------------|-------------|------------------|
| API | Асинхронный (`async_spawn`) | Синхронный |
| Метод подписания | `SignCades()` с содержимым | `SignHash()` с хешем |
| Выбор сертификата | По thumbprint | По Subject Name |
| Большие файлы | Загружает весь файл в память | Читает по частям (3MB) |
| Проверка подписи | Нет | Да (автоматическая) |
| Файлы API | `nmcades_plugin_api.js` | `cadesplugin_api.js` |

## Важные замечания

- Страница должна быть открыта через HTTP/HTTPS (не file://)
- CryptoPro Browser Plugin должен быть установлен и активен
- Браузер должен поддерживать CryptoPro плагин (обычно Chrome или Edge)
- Для больших файлов рекомендуется использовать hash-based версию