# Vanilla Sign Example

Минимальный пример подписания файлов с использованием CryptoPro Browser Plugin без React.

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

Затем откройте в браузере: `http://localhost:8000`

### Вариант 2: Node.js http-server

Если у вас установлен Node.js:

```bash
# Установите http-server глобально (один раз)
npm install -g http-server

# Запустите сервер
cd vanilla-sign-example
http-server -p 8000
```

Затем откройте в браузере: `http://localhost:8000`

### Вариант 3: VS Code Live Server

Если вы используете VS Code:

1. Установите расширение "Live Server"
2. Правый клик на `index.html` → "Open with Live Server"

### Вариант 4: Другие серверы

Любой другой HTTP сервер подойдет, например:
- PHP: `php -S localhost:8000`
- Ruby: `ruby -run -e httpd . -p 8000`

## Использование

1. Откройте страницу в браузере (Chrome/Edge с установленным CryptoPro плагином)
2. Нажмите "Активировать плагин"
3. Выберите сертификат из списка
4. Выберите файл для подписания
5. Нажмите "Подписать файл"
6. Файл подписи `.sig` будет автоматически скачан

## Важные замечания

- Страница должна быть открыта через HTTP/HTTPS (не file://)
- CryptoPro Browser Plugin должен быть установлен и активен
- Браузер должен поддерживать CryptoPro плагин (обычно Chrome или Edge)
