# FEAT-054: Deploy на Timeweb Cloud VPS

**Статус:** TODO
**Приоритет:** P0
**Зависимости:** FEAT-031 (Chart Build), FEAT-033 (Sentry), FEAT-032 (Pino), Dockerfile improvements
**Блокирует:** Production Launch

---

## Контекст решения

### Почему Timeweb Cloud?

**Рассмотренные варианты:**

| Платформа | Цена/мес | Setup | Вердикт |
|-----------|----------|-------|---------|
| Fly.io | ~$19-25 | 3.5ч, 5 fly.toml | ❌ Дорого, US-компания (санкции) |
| Hetzner | €3-5 | 2-3ч | ❌ Не работает с РФ с 01.2024, блокировки РКН |
| Railway | ~$40 | 30мин, UI only | ❌ Нет консольного доступа, дорого |
| Render | ~$50 | 30мин, UI only | ❌ Нет консольного доступа, дорого |
| Aeza | ~€5 | 2ч | ⚠️ Смешанные отзывы о поддержке |
| **Timeweb Cloud** | **~600₽ (~€5)** | **2-3ч**, готовый docker-compose | ✅ **Выбран** |

**Ключевые факторы:**
1. **Оплата из РФ** — карты российских банков, СБП, SberPay (без посредников)
2. **SLA 99.98%** — лучший показатель среди кандидатов
3. **10 дней бесплатный тест** — можно проверить перед оплатой
4. **EU-локации** — Нидерланды (низкий latency до Telegram API)
5. **Готовая инфраструктура** — docker-compose.yml уже есть
6. **Полный контроль** — root доступ, KVM виртуализация
7. **Почасовая тарификация** — гибкость для MVP
8. **API + мобильное управление** — удобно для DevOps

### Что теряем vs Fly.io

| Фича Fly.io | Решение на Timeweb |
|-------------|-------------------|
| Zero-downtime deploy | 10 сек downtime при редеплое (ок для MVP) |
| Автоматический TLS | Certbot + nginx (30 мин настройки) |
| `fly logs` | `ssh server docker logs` или Sentry |
| Managed Postgres backups | pg_dump + cron → R2 |

### Требования к ресурсам

Расчёт для 10-20 concurrent users:

| Сервис | RAM | Лимит |
|--------|-----|-------|
| neo4j | ~1GB | 1.2GB |
| postgres | ~256MB | 512MB |
| redis | ~50MB | 128MB |
| core | ~100MB | 256MB |
| facade | ~150MB | 512MB |
| telegram-bot | ~80MB | 256MB |
| nginx | ~20MB | 64MB |
| OS + buffer | ~500MB | — |
| **ИТОГО** | **~2.2GB** | **~3GB** |

**Рекомендуемый инстанс:** Timeweb Cloud-4 (4GB RAM, 2 vCPU, 40GB NVMe) — ~800₽/мес (~€7)

> **Примечание:** 10 дней бесплатного теста — можно проверить конфигурацию перед оплатой

---

## Архитектура деплоя

```
┌─────────────────────────────────────────────────────────────┐
│                 Timeweb Cloud VPS (Cloud-4)                  │
│              4GB RAM, 2 vCPU, 40GB NVMe, Нидерланды          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     nginx                            │    │
│  │              (reverse proxy + TLS)                   │    │
│  │                    :80, :443                         │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┼──────────────────────────────┐    │
│  │           Docker Network (bridge)                    │    │
│  ├──────────────────────┼──────────────────────────────┤    │
│  │                      │                               │    │
│  │  ┌─────────────┐  ┌──┴──────────┐  ┌─────────────┐  │    │
│  │  │telegram-bot │  │   facade    │  │    core     │  │    │
│  │  │  (grammY)   │──│  (FastMCP)  │──│   (tRPC)    │  │    │
│  │  │   :3003     │  │   :3002     │  │   :3001     │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  │         │                │                │          │    │
│  │  ┌──────┴────────────────┼────────────────┘          │    │
│  │  │                       │                           │    │
│  │  │  ┌─────────┐    ┌─────────┐    ┌─────────┐       │    │
│  │  │  │ neo4j   │    │postgres │    │  redis  │       │    │
│  │  │  │ :7687   │    │ :5432   │    │ :6379   │       │    │
│  │  │  │(volume) │    │(volume) │    │         │       │    │
│  │  │  └─────────┘    └─────────┘    └─────────┘       │    │
│  │  └───────────────────────────────────────────────────│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Volumes:                                                    │
│  - neo4j_prod_data     (persistent)                         │
│  - postgres_prod_data  (persistent)                         │
│  - nginx_certs         (Let's Encrypt)                      │
├─────────────────────────────────────────────────────────────┤
│  External:                                                   │
│  - Cloudflare R2 (charts, backups)                          │
│  - OpenRouter (LLM)                                         │
│  - Sentry (monitoring)                                      │
│  - Telegram API                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## План реализации

### Фаза 1: Подготовка локально (~1 час)

- [ ] Обновить Dockerfile (non-root user, compiled JS)
- [ ] Добавить telegram-bot в docker-compose.yml (profile: prod)
- [ ] Добавить nginx сервис в docker-compose.yml
- [ ] Создать `nginx/nginx.conf`
- [ ] Создать `scripts/deploy.sh`
- [ ] Создать `Makefile`
- [ ] Проверить `docker-compose --profile prod up` локально

### Фаза 2: Настройка Timeweb Cloud VPS (~30 мин)

- [ ] Зарегистрироваться на [timeweb.cloud](https://timeweb.cloud)
- [ ] Активировать 10-дневный бесплатный тест
- [ ] Создать VPS в [console.timeweb.cloud](https://console.timeweb.cloud)
  - Локация: **Нидерланды** (низкий latency до Telegram API)
  - Image: Ubuntu 24.04
  - Тариф: Cloud-4 (4GB RAM, 2 vCPU, 40GB NVMe) — ~800₽/мес
  - SSH Key: добавить свой публичный ключ
- [ ] Записать IP адрес
- [ ] Настроить DNS (A record → IP)

### Фаза 3: Настройка сервера (~1 час)

```bash
# SSH на сервер
ssh root@<IP>

# Обновить систему
apt update && apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com | sh

# Установить Docker Compose plugin
apt install docker-compose-plugin -y

# Создать директорию
mkdir -p /opt/waymates
cd /opt/waymates

# Clone репозитория (с submodule если после FEAT-036)
git clone --recurse-submodules <repo> .

# Скопировать .env.prod
# (локально: scp .env.prod root@<IP>:/opt/waymates/)

# Настроить firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (для certbot)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Фаза 4: TLS сертификат (~15 мин)

```bash
# Установить certbot
apt install certbot -y

# Получить сертификат (перед запуском nginx)
certbot certonly --standalone -d waymates.example.com

# Сертификаты будут в:
# /etc/letsencrypt/live/waymates.example.com/fullchain.pem
# /etc/letsencrypt/live/waymates.example.com/privkey.pem

# Автообновление (уже настроено через systemd timer)
systemctl status certbot.timer
```

### Фаза 5: Деплой (~30 мин)

```bash
cd /opt/waymates

# Запустить всё
docker compose --profile prod up -d

# Инициализировать Neo4j схему
docker compose exec neo4j-prod cypher-shell -u neo4j -p <password> -f /tmp/init.cypher

# Проверить статус
docker compose --profile prod ps

# Проверить логи
docker compose --profile prod logs -f
```

### Фаза 6: Проверка (~15 мин)

- [ ] `https://waymates.example.com` открывается (nginx)
- [ ] Telegram Bot отвечает на /start
- [ ] Cold-start flow работает
- [ ] Search flow работает
- [ ] Charts генерируются
- [ ] Sentry получает события
- [ ] `docker compose logs` показывает structured logs

---

## Новые файлы

### nginx/nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream telegram_bot {
        server telegram-bot:3003;
    }

    upstream facade {
        server facade:3002;
    }

    # Redirect HTTP → HTTPS
    server {
        listen 80;
        server_name waymates.example.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name waymates.example.com;

        ssl_certificate /etc/letsencrypt/live/waymates.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/waymates.example.com/privkey.pem;

        # SSL settings
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;

        # Telegram webhook
        location /webhook {
            proxy_pass http://telegram_bot;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Health check
        location /health {
            proxy_pass http://facade;
        }

        # Default
        location / {
            return 200 'WayMates API';
            add_header Content-Type text/plain;
        }
    }
}
```

### scripts/deploy.sh

```bash
#!/bin/bash
set -e

SERVER="${1:-root@waymates.example.com}"
REMOTE_DIR="/opt/waymates"

echo "🚀 Deploying to $SERVER..."

ssh $SERVER << 'EOF'
cd /opt/waymates

echo "📥 Pulling latest code..."
git pull --recurse-submodules

echo "🔨 Building containers..."
docker compose --profile prod build

echo "🔄 Restarting services..."
docker compose --profile prod up -d

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deploy complete!"
docker compose --profile prod ps
EOF
```

### Makefile

```makefile
.PHONY: deploy logs ssh status restart backup

SERVER ?= root@waymates.example.com
REMOTE_DIR = /opt/waymates

# Deploy to production
deploy:
	./scripts/deploy.sh $(SERVER)

# View logs
logs:
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose --profile prod logs -f --tail=100"

# SSH to server
ssh:
	ssh $(SERVER)

# Check status
status:
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose --profile prod ps"

# Restart all services
restart:
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose --profile prod restart"

# Backup databases
backup:
	ssh $(SERVER) "cd $(REMOTE_DIR) && ./scripts/backup.sh"

# Local development
dev:
	docker compose --profile test up -d

dev-down:
	docker compose --profile test down
```

### scripts/backup.sh

```bash
#!/bin/bash
set -e

BACKUP_DIR="/tmp/waymates-backup"
DATE=$(date +%Y-%m-%d-%H%M)
R2_BUCKET="${R2_BUCKET_NAME:-waymates-backups}"

mkdir -p $BACKUP_DIR

echo "📦 Backing up PostgreSQL..."
docker compose exec -T postgres-prod pg_dump -U waymates waymates > "$BACKUP_DIR/postgres-$DATE.sql"

echo "📦 Backing up Neo4j..."
docker compose exec -T neo4j-prod cypher-shell -u neo4j -p "$NEO4J_PASSWORD" \
  "CALL apoc.export.json.all('/tmp/neo4j-backup.json', {})" || true
docker cp waymates-neo4j-prod:/tmp/neo4j-backup.json "$BACKUP_DIR/neo4j-$DATE.json"

echo "☁️ Uploading to R2..."
# Requires rclone configured with R2
rclone copy "$BACKUP_DIR" "r2:$R2_BUCKET/backups/$DATE/"

echo "🧹 Cleaning up..."
rm -rf $BACKUP_DIR

echo "✅ Backup complete: $DATE"
```

---

## Дополнения в docker-compose.yml

```yaml
services:
  # ... existing prod services ...

  nginx:
    image: nginx:alpine
    container_name: waymates-nginx
    profiles: ["prod"]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      telegram-bot:
        condition: service_healthy
      facade-prod:
        condition: service_healthy
    restart: unless-stopped

  telegram-bot:
    build:
      context: .
      dockerfile: Dockerfile
      target: telegram-bot-production
    container_name: waymates-telegram-bot
    profiles: ["prod"]
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      FACADE_MCP_URL: http://facade-prod:3002
      SENTRY_DSN: ${SENTRY_DSN}
      NODE_ENV: production
    depends_on:
      facade-prod:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3003/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
```

---

## Environment Variables

**.env.prod:**
```bash
# Neo4j
NEO4J_PASSWORD=<secure-password>
NEO4J_HEAP_INITIAL=512m
NEO4J_HEAP_MAX=1024m
NEO4J_PAGECACHE=256m

# PostgreSQL
POSTGRES_USER=waymates
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=waymates

# Redis
REDIS_PORT=6379

# Core
CORE_PORT=3001
NEO4J_URI=bolt://neo4j-prod:7687
NEO4J_USER=neo4j

# Facade
FACADE_HTTP_PORT=3002
CORE_API_URL=http://core-prod:3001
OPENROUTER_API_KEY=<key>
LANGCHAIN_MODEL_NAME=openai/gpt-4o-mini

# Telegram
TELEGRAM_BOT_TOKEN=<token>

# Monitoring
SENTRY_DSN=<dsn>

# R2 (charts + backups)
R2_ACCOUNT_ID=<id>
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=waymates-prod
R2_PUBLIC_URL=https://cdn.waymates.example.com
```

---

## Acceptance Criteria

- [ ] VPS создан и доступен по SSH
- [ ] Docker + Docker Compose установлены
- [ ] TLS сертификат получен (certbot)
- [ ] Все сервисы запускаются (`docker compose --profile prod up`)
- [ ] nginx проксирует запросы
- [ ] Telegram Bot отвечает на сообщения
- [ ] Cold-start flow работает end-to-end
- [ ] Search flow работает
- [ ] Charts генерируются и загружаются в R2
- [ ] Sentry получает ошибки
- [ ] Health checks проходят
- [ ] `make deploy` работает
- [ ] `make logs` показывает логи
- [ ] Backup скрипт работает

---

## Операции (Day 2)

### Ежедневные команды

```bash
make status      # Проверить что всё работает
make logs        # Посмотреть логи
make deploy      # Задеплоить новую версию
make restart     # Перезапустить сервисы
make backup      # Сделать бэкап
make ssh         # Зайти на сервер
```

### Обновление сертификата

Certbot автоматически обновляет сертификаты через systemd timer.
Проверить: `systemctl status certbot.timer`

### Мониторинг

- **Sentry** — ошибки и performance
- **Docker logs** — детальные логи сервисов
- **htop** — ресурсы сервера

---

## Риски и митигации

| Риск | Митигация |
|------|-----------|
| OOM на 4GB RAM | Resource limits в docker-compose, мониторинг через htop |
| Потеря данных | Ежедневный backup в R2, Timeweb snapshots |
| Сертификат истёк | Certbot timer автообновляет, alert в Sentry при ошибках |
| Сервер недоступен | Timeweb 99.98% SLA, Sentry downtime alerts |
| DDoS | Cloudflare перед nginx (опционально) |

---

## Стоимость

| Компонент | Цена/мес |
|-----------|----------|
| Timeweb Cloud-4 | ~800₽ (~€7) |
| Timeweb backup | Включено |
| Domain (годовая / 12) | ~100₽ (~€1) |
| **ИТОГО** | **~900₽/мес (~€8)** |

vs Fly.io: **$19-25/мес** → экономия **~$150/год**

> **Бонус:** 10 дней бесплатного теста + почасовая тарификация для гибкости

---

## Оценка времени

| Фаза | Время |
|------|-------|
| Подготовка локально | 1 час |
| Настройка Timeweb Cloud VPS | 30 мин |
| Настройка сервера | 1 час |
| TLS сертификат | 15 мин |
| Деплой | 30 мин |
| Проверка | 15 мин |
| **ИТОГО** | **~3.5 часа** |

---

## Ссылки

- [Timeweb Cloud Console](https://console.timeweb.cloud)
- [Timeweb Cloud Pricing](https://timeweb.cloud/vds-vps)
- [Timeweb Cloud Servers Europe](https://timeweb.cloud/services/servers-europe)
- [Certbot Instructions](https://certbot.eff.org/instructions)
- [Docker Compose Deploy](https://docs.docker.com/compose/production/)
- [MVP-RELEASE-PLAN.md](../../docs/mvp_final/MVP-RELEASE-PLAN.md) — Фаза 7

---

## Почему не Hetzner?

> **Решение от января 2025:** Hetzner был первоначальным выбором, но отклонён по следующим причинам:
>
> 1. **Hetzner прекратил работу с РФ** — с 31.01.2024 не обслуживает российские аккаунты
> 2. **Оплата невозможна** — карты РФ (Visa/MC/Мир) отклоняются биллингом
> 3. **Блокировки РКН** — с июня 2025 DPI-фильтрация, HTTPS обрезается после 16КБ
> 4. **Риск аккаунта** — даже через посредников есть риск закрытия при обнаружении
>
> Timeweb Cloud даёт ~90% качества Hetzner с нормальной оплатой из РФ.
