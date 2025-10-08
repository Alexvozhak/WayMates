# Настройка локальной разработки с облачными БД

**Дата:** 2025-09-11  
**Версия:** 1.0  
**Цель:** Настройка бюджетной инфраструктуры для разработки WayMates

## 🎯 **Архитектура решения**

```yaml
Компоненты:
  - Neo4j AuraDB: Free tier (50k nodes) - графовая БД
  - Supabase PostgreSQL: Free tier (500MB) - операционная БД
  - NestJS приложение: Локально в Docker
  - AI/Telegram: Добавим позже

Стоимость: $0/месяц (пока без AI и Telegram)
Время настройки: 2-3 часа
```

## 📋 **Предварительные требования**

- Docker и Docker Compose установлены
- Node.js 18+ установлен
- Аккаунты на neo4j.com и supabase.com (создадим)

## 🚀 **Этап 1: Облачные БД (30 минут)**

### 1.1 Neo4j AuraDB Free (10 минут)

1. **Регистрация:**
   - Идете на https://aura.neo4j.io
   - Нажимаете "Start Free"
   - Регистрируетесь (email + пароль)

2. **Создание инстанса:**
   - Name: `waymates-dev`
   - Region: выбираете ближайший (например, Europe)
   - Password: генерируете сложный пароль (сохраните!)

3. **Ожидание:**
   - Ждете создания (2-3 минуты)
   - Получаете connection string: `neo4j+s://xxx.databases.neo4j.io`

### 1.2 Supabase PostgreSQL Free (10 минут)

1. **Регистрация:**
   - Идете на https://supabase.com
   - Нажимаете "Start your project"
   - Регистрируетесь через GitHub

2. **Создание проекта:**
   - Name: `waymates`
   - Database Password: генерируете сложный пароль (сохраните!)
   - Region: выбираете ближайший

3. **Получение данных:**
   - Ждете создания (2-3 минуты)
   - Идете в Settings → Database
   - Копируете connection string: `postgresql://postgres:xxx@xxx.supabase.co:5432/postgres`

### 1.3 Создание .env файла (5 минут)

```bash
# Создаете файл .env в корне проекта
touch .env
```

Добавляете в `.env`:
```env
# Neo4j AuraDB
NEO4J_URI=neo4j+s://xxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=ваш-пароль-от-aura

# Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:xxx@xxx.supabase.co:5432/postgres

# Пока без Telegram и OpenAI (добавим позже)
# TELEGRAM_BOT_TOKEN=будет-позже
# OPENAI_API_KEY=будет-позже
```

## 🛠️ **Этап 2: Локальная разработка (1-2 часа)**

### 2.1 Обновление docker-compose.yml

```yaml
version: '3.8'
services:
  # Только ваше приложение локально
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      # Облачные БД
      NEO4J_URI: ${NEO4J_URI}
      NEO4J_USER: ${NEO4J_USER}
      NEO4J_PASSWORD: ${NEO4J_PASSWORD}
      
      DATABASE_URL: ${DATABASE_URL}
      
      # Пока без AI и Telegram
      NODE_ENV: development
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run start:dev
```

### 2.2 Установка зависимостей

```bash
# Устанавливаете необходимые пакеты
npm install pg neo4j-driver
npm install -D @types/pg
```

### 2.3 Создание тестового скрипта

Создайте файл `test-connections.ts`:

```typescript
import { Pool } from 'pg';
import neo4j from 'neo4j-driver';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function testConnections() {
  console.log('🔧 Тестируем подключения...');
  
  // Тест PostgreSQL
  try {
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pgPool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL подключен:', result.rows[0].now);
    client.release();
    await pgPool.end();
  } catch (error) {
    console.error('❌ PostgreSQL ошибка:', error.message);
  }
  
  // Тест Neo4j
  try {
    const driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );
    
    const session = driver.session();
    const result = await session.run('RETURN "Hello Neo4j!" as message');
    console.log('✅ Neo4j подключен:', result.records[0].get('message'));
    await session.close();
    await driver.close();
  } catch (error) {
    console.error('❌ Neo4j ошибка:', error.message);
  }
}

testConnections();
```

### 2.4 Запуск и тестирование

```bash
# Запускаете тест подключений
npx ts-node test-connections.ts

# Ожидаемый результат:
# ✅ PostgreSQL подключен: 2025-01-11T10:30:00.000Z
# ✅ Neo4j подключен: Hello Neo4j!

# Если все ОК, запускаете приложение
docker-compose up
```

## 🏗️ **Этап 3: Настройка NestJS (1-2 часа)**

### 3.1 Обновление database.module.ts

```typescript
// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import neo4j from 'neo4j-driver';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'PG_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        const pool = new Pool({
          connectionString: configService.get('DATABASE_URL'),
          ssl: { rejectUnauthorized: false },
        });
        
        // Тест соединения
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected successfully');
        client.release();
        
        return pool;
      },
      inject: [ConfigService],
    },
    {
      provide: 'NEO4J_DRIVER',
      useFactory: (configService: ConfigService) => {
        const driver = neo4j.driver(
          configService.get('NEO4J_URI'),
          neo4j.auth.basic(
            configService.get('NEO4J_USER'),
            configService.get('NEO4J_PASSWORD')
          )
        );
        
        console.log('✅ Neo4j connected successfully');
        return driver;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['PG_CONNECTION', 'NEO4J_DRIVER'],
})
export class DatabaseModule {}
```

### 3.2 Создание тестового контроллера

```typescript
// src/test/test.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';

@Controller('test')
export class TestController {
  constructor(
    @Inject('PG_CONNECTION') private pgPool: any,
    @Inject('NEO4J_DRIVER') private neo4jDriver: any,
  ) {}

  @Get('postgres')
  async testPostgres() {
    const client = await this.pgPool.connect();
    const result = await client.query('SELECT NOW() as time, version() as version');
    client.release();
    return result.rows[0];
  }

  @Get('neo4j')
  async testNeo4j() {
    const session = this.neo4jDriver.session();
    const result = await session.run('RETURN "Hello from Neo4j!" as message');
    await session.close();
    return { message: result.records[0].get('message') };
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        postgres: 'connected',
        neo4j: 'connected'
      }
    };
  }
}
```

### 3.3 Обновление app.module.ts

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { TestController } from './test/test.controller';

import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
  ],
  controllers: [TestController],
  providers: [],
})
export class AppModule {}
```

## 🧪 **Этап 4: Тестирование (30 минут)**

### 4.1 Запуск приложения

```bash
# Запускаете приложение
docker-compose up

# В логах должны увидеть:
# ✅ PostgreSQL connected successfully
# ✅ Neo4j connected successfully
# 🚀 WayMates Career Intelligence Platform running on port 3000
```

### 4.2 Тестирование API

```bash
# В другом терминале тестируете API
curl http://localhost:3000/test/health
curl http://localhost:3000/test/postgres
curl http://localhost:3000/test/neo4j
```

### 4.3 Ожидаемые результаты

**GET /test/health:**
```json
{
  "status": "OK",
  "timestamp": "2025-01-11T10:30:00.000Z",
  "services": {
    "postgres": "connected",
    "neo4j": "connected"
  }
}
```

**GET /test/postgres:**
```json
{
  "time": "2025-01-11T10:30:00.000Z",
  "version": "PostgreSQL 15.4 on x86_64-pc-linux-gnu"
}
```

**GET /test/neo4j:**
```json
{
  "message": "Hello from Neo4j!"
}
```

## ✅ **Итог после настройки**

```yaml
Что у вас есть:
✅ Neo4j AuraDB Free (50k nodes) - готова к работе
✅ Supabase PostgreSQL Free (500MB) - готова к работе
✅ NestJS приложение локально - работает
✅ API для тестирования подключений - работает
✅ Готовая инфраструктура для разработки

Стоимость: $0/месяц
Время настройки: 2-3 часа
Статус: Готово к разработке бизнес-логики
```

## 🚀 **Следующие шаги (когда будете готовы)**

### Этап 5: Добавление AI (1-2 часа)
- Регистрация в OpenAI
- Добавление API ключа в .env
- Интеграция с NestJS

### Этап 6: Добавление Telegram Bot (2-3 часа)
- Создание бота через @BotFather
- Добавление токена в .env
- Реализация polling или webhook

### Этап 7: Бизнес-логика (1-2 недели)
- Анализ навыков через Neo4j
- Сохранение пользователей в PostgreSQL
- AI-рекомендации через OpenAI

## 🆘 **Решение проблем**

### Проблема: "PostgreSQL connection failed"
```bash
# Проверьте:
1. Правильность DATABASE_URL в .env
2. Доступность Supabase проекта
3. Правильность пароля
```

### Проблема: "Neo4j connection failed"
```bash
# Проверьте:
1. Правильность NEO4J_URI в .env
2. Доступность AuraDB инстанса
3. Правильность пароля
```

### Проблема: "Docker build failed"
```bash
# Проверьте:
1. Наличие Dockerfile
2. Правильность package.json
3. Установленные зависимости
```

## 📝 **Полезные команды**

```bash
# Просмотр логов
docker-compose logs -f app

# Перезапуск приложения
docker-compose restart app

# Остановка всех сервисов
docker-compose down

# Очистка Docker кэша
docker system prune -f
```

---

**Автор:** WayMates Team  
**Дата создания:** 2025-09-11  
**Статус:** Готово к использованию


