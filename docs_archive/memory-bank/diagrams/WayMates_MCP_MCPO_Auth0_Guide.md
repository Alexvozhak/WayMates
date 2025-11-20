
# WayMates: Универсальная интеграция (ChatGPT Actions + LibreChat + Telegram + MCP через mcpo)

**Цель:** запустить минимально жизнеспособную архитектуру (MVP), где один и тот же пользователь узнаётся в разных «входах» (ChatGPT Custom GPT, LibreChat, Telegram), а бизнес‑логика доступна через **WayMates MCP**, прокинутый в **mcpo** (MCP→OpenAPI).

---

## 🧱 Обзор сущностей и ролей

- **Пользователь** — человек, который может зайти из Telegram, ChatGPT, LibreChat.
- **IdP (Auth0)** — «поставщик личности»; логин по **OAuth 2.0 + OIDC**, даёт токен с `sub` (кто это).
- **mcpo (facade)** — **HTTP-сервер** (Fastify) с OpenAPI и OAuth, который:
  1) принимает вызовы **ChatGPT Actions** и (при желании) **Open WebUI/n8n**;
  2) **проверяет токен**, находит/создаёт пользователя в БД (**Drizzle + SQLite**);
  3) вызывает **WayMates MCP** по **HTTP** (streamable-http);
  4) возвращает JSON-ответ.
- **WayMates MCP (server)** — твой сервер инструментов (NL2Cypher / queryGraph / rank / explain), доступный по HTTP.
- **LibreChat** — UI‑клиент с нативным MCP (на будущее) и/или с OpenAPI Tool (через mcpo).
- **Telegram Bot** — для связи телеги с той же учёткой (одноразовый код).
- **n8n** — автомейшн-сценарии, бьёт в **mcpo** (machine-to-machine токен).

---

## 🔗 Общая схема связей (ASCII)

```
[User] ──(OAuth 2.0 + OIDC via Auth0)──▶ [ChatGPT: Custom GPT (Actions)]
   │                                         │
   │                                  Authorization: Bearer <JWT>
   │                                         │
[Telegram Bot]──/link→[code in Redis]◀───────┘
   │
   └─ one-time code ─────────────────────────────────────────────┐
                                                                 │
                                        [mcpo (Fastify + OpenAPI)]
                                          │ (verify JWT via JWKS)
                                          │ findOrCreate by oidc_sub
                                          │ linkTelegram(user_internal_id, telegram_id)
                                          ▼
                                       [WayMates MCP (HTTP)]
                                          │
                                          ▼
                                        [Neo4j/…]

Дополнительно:
[LibreChat] ──(сервер→mcpo по HTTP/OpenAPI)──▶ [mcpo]
[n8n] ──(machine token)──▶ [mcpo]
```

---

## 🪜 Пошаговый гайд (S1 → S10)

### S1. Создаём БД (Drizzle + SQLite)

**Задача:** хранить устойчивую связь внешних ID ↔ `user_internal_id`.

1) Установи зависимости:
   ```bash
   npm i better-sqlite3 drizzle-orm
   npm i -D drizzle-kit
   ```
2) `schema.ts`:
   ```ts
   import { sqliteTable, text } from "drizzle-orm/sqlite-core";

   export const identities = sqliteTable("identities", {
     user_internal_id: text("user_internal_id").primaryKey(),
     oidc_sub:         text("oidc_sub").unique(),
     oidc_provider:    text("oidc_provider"),
     email:            text("email"),
     telegram_id:      text("telegram_id").unique(),
     created_at:       text("created_at").default("CURRENT_TIMESTAMP"),
     updated_at:       text("updated_at").default("CURRENT_TIMESTAMP"),
   });
   ```
3) `db.ts`:
   ```ts
   import Database from "better-sqlite3";
   import { drizzle } from "drizzle-orm/better-sqlite3";
   export const sqlite = new Database("identities.db");
   export const db = drizzle(sqlite);
   ```
4) `repo.ts`:
   ```ts
   import { eq } from "drizzle-orm";
   import { db } from "./db";
   import { identities } from "./schema";

   export async function findOrCreateByOidcSub(oidc_sub: string, email?: string | null) {
     const rows = await db.select().from(identities).where(eq(identities.oidc_sub, oidc_sub));
     if (rows.length) return rows[0];
     const id = crypto.randomUUID();
     await db.insert(identities).values({ user_internal_id: id, oidc_sub, oidc_provider: "oidc", email: email ?? null });
     const [created] = await db.select().from(identities).where(eq(identities.oidc_sub, oidc_sub));
     return created!;
   }

   export async function linkTelegram(user_internal_id: string, telegram_id: string) {
     await db.update(identities)
       .set({ telegram_id, updated_at: new Date().toISOString() })
       .where(eq(identities.user_internal_id, user_internal_id));
   }
   ```
5) Drizzle config (`drizzle.config.ts`) и команды миграций — добавь по доке Drizzle. Сгенерируй первую миграцию.

> **Почему так:** одна таблица, типы, миграции в репо, нулевая админка.

---

### S2. Регистрируем приложение в Auth0 (IdP)

**Цель:** получать валидные JWT (OIDC) в ChatGPT Actions → mcpo.

1) В **Auth0 Dashboard**: _Applications → Create Application → Regular Web App_.
2) Скопируй:  
   - `client_id`, `client_secret`  
   - `issuer` (домен твоего тенанта, напр. `https://YOUR_TENANT.auth0.com`)  
   - `authorizationUrl` = `${issuer}/authorize`  
   - `tokenUrl` = `${issuer}/oauth/token`  
   - `jwks.json` = `${issuer}/.well-known/jwks.json`
3) **Allowed Callback URLs (Redirect URIs)**: добавь **redirect URL**, который покажет **ChatGPT GPT‑builder** в разделе **Actions** (без этого вход не завершится).
4) **Scopes**: для MVP достаточно **`openid`**.

> Позже можно добавить `email`/`profile`, если нужны имя/почта.

---

### S3. Готовим mcpo (Fastify + OAuth проверка)

1) Установи зависимости:
   ```bash
   npm i fastify @fastify/cors jose node-fetch
   ```
2) `.env`:
   ```env
   OIDC_ISSUER=https://YOUR_TENANT.auth0.com
   OIDC_AUDIENCE=your-api-identifier   # опционально, если используешь audience
   PORT=8080
   MCP_HTTP_URL=http://waymates-mcp:9000
   MCP_TOKEN=secret-token-if-needed
   ```
3) `auth.ts` — **отдельным шагом проверяем токен**, затем ищем/создаём пользователя:
   ```ts
   import { createRemoteJWKSet, jwtVerify } from "jose";
   import type { FastifyReply, FastifyRequest } from "fastify";
   import { findOrCreateByOidcSub } from "./repo";

   const ISSUER = process.env.OIDC_ISSUER!;
   const AUD = process.env.OIDC_AUDIENCE || undefined;
   const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

   export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
     const auth = String(req.headers["authorization"] || "");
     const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
     if (!token) return reply.code(401).send({ error: "missing token" });

     const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUD });
     const oidc_sub = String(payload.sub);
     const email = (payload.email as string) || null;

     const user = await findOrCreateByOidcSub(oidc_sub, email);
     (req as any).user = { id: user.user_internal_id, oidc_sub, email };
   }
   ```
4) `mcpClient.ts` — HTTP-клиент к твоему MCP:
   ```ts
   export async function mcpQueryGraph(userId: string, cypher: string) {
     const r = await fetch(`${process.env.MCP_HTTP_URL}/queryGraph`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${process.env.MCP_TOKEN}`
       },
       body: JSON.stringify({ userId, cypher })
     });
     if (!r.ok) throw new Error(`MCP HTTP ${r.status}`);
     return r.json();
   }
   ```
5) `server.ts` — mcpo фасад:
   ```ts
   import Fastify from "fastify";
   import { requireUser } from "./auth";
   import { mcpQueryGraph } from "./mcpClient";

   const app = Fastify({ logger: true });

   // CORS не включаем для ChatGPT (сервер→сервер). Добавишь позже для портала/SPA при необходимости.

   app.post("/queryGraph", { preHandler: requireUser }, async (req: any) => {
     const { cypher } = req.body as { cypher: string };
     const userId = req.user.id;
     const data = await mcpQueryGraph(userId, cypher);
     return { ok: true, data };
   });

   app.listen({ port: Number(process.env.PORT || 8080), host: "0.0.0.0" });
   ```

---

### S4. OpenAPI-спека mcpo (для ChatGPT Actions / LibreChat / n8n)

**Мини-YAML (фрагмент):**
```yaml
openapi: 3.0.3
info:
  title: WayMates mcpo
  version: 1.0.0
servers:
  - url: https://api.waymates.io
components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://YOUR_TENANT.auth0.com/authorize
          tokenUrl: https://YOUR_TENANT.auth0.com/oauth/token
          scopes:
            openid: OpenID scope
security:
  - oauth2: [openid]
paths:
  /queryGraph:
    post:
      operationId: queryGraph
      security: [{ oauth2: [openid] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                cypher: { type: string }
              required: [cypher]
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  data: { type: object }
```

> Расширишь позже (`/nl2cypher`, `/rank`, `/explain`, `/link-telegram`).

---

### S5. Подключаем ChatGPT Custom GPT → Actions

1) Открой **Create a GPT** → вкладка **Actions**.  
2) Импортируй **OpenAPI** из S4.  
3) Включи **OAuth**: укажи `client_id`, `client_secret`, `authorizationUrl`, `tokenUrl`, `scopes: openid`.  
4) GPT‑builder покажет **Redirect URL** — добавь его в **Auth0 → Allowed Callback URLs**.  
5) Сохрани GPT. При первом вызове Action GPT предложит «Connect» → пользователь залогинится (Auth0), дальше токен пойдёт к mcpo автоматически.

---

### S6. Привязка Telegram через бота (рекомендуемый способ)

**Что видит пользователь:**
1) В боте `/link` → бот присылает код `AB12CD` (живет 2 минуты).
2) В ChatGPT (твой GPT) пользователь пишет: «привязать телеграм: AB12CD».  
   GPT вызывает Action `POST /link-telegram` (токен уже есть).
3) Получает ответ «Учётка связана». Теперь телега = тот же `user_internal_id`.

**Что под капотом:** Redis + одноразовый код.  

**Ручка mcpo:**
```ts
// POST /link-telegram
import { linkTelegram } from "./repo";

app.post("/link-telegram", { preHandler: requireUser }, async (req: any, reply) => {
  const { code } = req.body as { code: string };
  if (!code) return reply.code(400).send({ error: "code required" });

  const raw = await redis.get(`tg_link:${code}`);
  if (!raw) return reply.code(400).send({ error: "invalid_or_expired_code" });
  const { telegram_id } = JSON.parse(raw);

  await linkTelegram(req.user.id, String(telegram_id));
  await redis.del(`tg_link:${code}`);

  return reply.send({ ok: true });
});
```

**Бот:**
```ts
// при /link
const code = genCode(6); // A-Z0-9
await redis.setEx(`tg_link:${code}`, 120, JSON.stringify({ telegram_id }));
bot.reply(`Код для привязки: ${code} (действует 2 минуты)`);
```

---

### S7. LibreChat и n8n

- **LibreChat**: для сравнения «MCP vs без MCP» можешь:  
  - либо подключить **нативный MCP** (в будущем),  
  - либо использовать **OpenAPI Tool** и бить в **mcpo** (унификация).  
  Для голосового ввода — включи их TTS/STT (из коробки).

- **n8n**: подключайся к **mcpo** (OpenAPI/HTTP).  
  - Лучше выделить **machine-to-machine** OAuth (Client Credentials) или API‑ключ для нод n8n.

---

### S8. CORS — включай только при фронтенде в браузере

- **Не нужен** для ChatGPT Actions (сервер→сервер) и стандартного LibreChat (сервер→mcpo).  
- **Нужен**, если у тебя появится **SPA/портал**, который из браузера будет ходить к mcpo на другом домене.  
- Включается на mcpo:
  ```ts
  import cors from "@fastify/cors";
  await app.register(cors, { origin: ["https://portal.waymates.io"], credentials: true });
  ```

---

### S9. Безопасность и важные мелочи (чек-лист)

- Проверяй JWT: `issuer`, подпись через `JWKS`, срок действия, (опц.) `audience`.
- Ограничивай размер тела запросов и время обработки (DoS).
- Генерируй короткие коды `/link` с TTL и rate‑limit, логируй попытки.
- Храни секреты (`client_secret`, `MCP_TOKEN`) вне репо (.env, секреты оркестратора).
- Логируй user_id + operationId для аудита.
- Версионируй OpenAPI (v1 → v2) без ломания клиентов.

---

### S10. Что ещё стоит проработать (вопросы «на потом»)

- **Модели доступа**: роли/квоты/лимиты на вызовы MCP (кто что может).  
  _Когда:_ после MVP, перед внешним пилотом.  
- **Обновление токенов (refresh)**: нужно ли ChatGPT (обычно нет — он сам обновляет), LibreChat/портал — подумать.  
  _Когда:_ при добавлении браузерного портала.  
- **Мульти‑IdP** (Google/Microsoft/GitHub одновременно): маппинг нескольких `oidc_sub` к одному `user_internal_id`.  
  _Когда:_ если планируешь разные логины.  
- **Политика PII/логов**: где хранить email/имя, GDPR/удаление по запросу.  
  _Когда:_ до прод-запуска.  
- **Наблюдаемость**: Langfuse / OpenTelemetry трассировки.  
  _Когда:_ после первого демо.  

---

## 🏁 Что запускать и в каком порядке

1) **Auth0**: создать приложение, записать параметры, добавить Redirect URL из GPT‑builder, `scope = openid`.
2) **БД**: Drizzle + SQLite, применить миграцию, проверить CRUD через `repo.ts`.
3) **mcpo**: поднять Fastify‑сервер (`/queryGraph`, `/link-telegram`), подключить `auth.ts` и `mcpClient.ts`.
4) **MCP**: убедиться, что HTTP‑эндпоинты работают (локально в Docker).
5) **ChatGPT**: импортировать OpenAPI, настроить OAuth, нажать Connect и протестировать `/queryGraph`.
6) **Telegram**: реализовать `/link` в боте, подключить Redis, проверить линковку через `link-telegram`.
7) **LibreChat/n8n**: по желанию — подключить к mcpo как OpenAPI‑клиенты.

Готово 💪
