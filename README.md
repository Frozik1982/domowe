# Płatności domowe

Tracker płatności domowych — aplikacja React/Vite. Działa lokalnie w przeglądarce, dane trzyma w `localStorage`.

## Uruchomienie lokalne (tryb deweloperski)

```bash
npm install
npm run dev
```

Otwórz http://localhost:5173

## Build produkcyjny

```bash
npm run build
npm run preview   # podgląd buildu lokalnie
```

Gotowe pliki trafiają do katalogu `dist/`.

## Wdrożenie na serwerze

### Opcja A — dowolny serwer HTTP (nginx, Apache, Caddy…)

```bash
npm run build
# Skopiuj zawartość dist/ na serwer
```

Przykładowa konfiguracja **nginx** (SPA — wszystkie ścieżki → index.html):

```nginx
server {
    listen 80;
    server_name twojadomena.pl;
    root /var/www/platnosci-domowe;   # tutaj wrzuć zawartość dist/

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Opcja B — Node.js + serve

```bash
npm install -g serve
npm run build
serve -s dist -l 3000
```

### Opcja C — Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
docker build -t platnosci-domowe .
docker run -p 8080:80 platnosci-domowe
```

## Technologie

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- framer-motion, recharts, sonner, date-fns
- Dane: localStorage (brak backendu, brak serwera bazy)
