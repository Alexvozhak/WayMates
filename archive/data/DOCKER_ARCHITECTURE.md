# 🐳 Docker Architecture для WayMates

## 📁 Файловая структура

```
docker-compose.yml      ← Основной файл (упрощённый, без профилей)
docker-compose.host.yml ← Для VPN (network_mode: host)
```

## 🎯 Сервисы

| Сервис | Порты | Env файл | Назначение |
|--------|-------|----------|------------|
| `neo4j-prod` | 7687:7687, 7474:7474 | `env.prod` | Продакшн БД |
| `neo4j-integration` | 7689:7687, 7476:7474 | `env.integration` | Integration тесты |
| `neo4j-functional` | 7688:7687, 7475:7474 | `env.functional` | Functional тесты |

## 🚀 Использование

### Обычное использование (без VPN)

```bash
# Продакшн
npm run docker:prod:up

# Тесты  
npm run test:integration
npm run test:functional
npm run test:all:parallel
```

### Для VPN (XRay и подобные)

```bash
# Если есть проблемы с Docker сетями из-за VPN
npm run test:integration:setup:vpn
npm run test:functional:setup:vpn
npm run docker:integration:up:vpn
```

## 🔧 Ручные команды

### Запуск отдельных сервисов

```bash
# Обычный режим
docker compose --env-file env.prod up neo4j-prod -d
docker compose --env-file env.integration up neo4j-integration -d
docker compose --env-file env.functional up neo4j-functional -d

# VPN режим
docker compose -f docker-compose.host.yml --env-file env.integration up neo4j-integration -d
```

### Остановка

```bash
docker compose stop neo4j-integration && docker compose rm -f neo4j-integration
docker compose stop neo4j-functional && docker compose rm -f neo4j-functional
```

## ⚙️ Настройки Neo4j

### Память (по умолчанию)

- **Production**: 512MB initial, 1GB max
- **Integration/Functional**: 128MB initial, 256MB max

### Healthcheck

- **Interval**: 2-3s 
- **Start period**: 8s (БД готова за ~5-8 секунд)
- **Timeout**: 2s

## 🚨 Проблемы и решения

### Docker сети переполнены

```bash
# Очистка
docker system prune --volumes -f

# Или restart Docker
sudo systemctl restart docker
```

### VPN конфликт

```bash
# Используй host network версию
npm run test:integration:setup:vpn
```

## 🎭 Архитектурные решения

### ✅ Что упростили

- **Убрали профили** - каждый сервис запускается напрямую
- **Простые команды** - `docker compose up neo4j-integration -d`
- **Минимум параметров** - только необходимые настройки

### 🎯 Что оставили

- **Изоляцию** - каждый тип тестов в своей БД
- **Env файлы** - разные настройки для разных окружений
- **VPN поддержку** - альтернативный файл для проблемных сетей
