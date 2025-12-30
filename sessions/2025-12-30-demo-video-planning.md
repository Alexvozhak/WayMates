# Session: Demo Video Planning

**Дата:** 2025-12-30
**Фокус:** Планирование demo video для pre-seed + эталонные данные

---

## Что сделано

### 1. Изучена архитектура для demo
- Cold Start v2: фазы, state, story_gathering flow
- Search Graph: explore → goal → pathfinders/waymates
- DTW метрики: Shape/Tempo/Alignment, как создать контраст
- Advisor: AdvisorContextBuilder с контекстом кандидатов

### 2. Спроектированы два сценария видео

**Видео 1 (Quick Search, ~3 мин):**
- Adhoc mode (без DTW)
- Flow: greeting → adhoc context → explore → goal → validate → pathfinders → advisor

**Видео 2 (Cold Start + DTW, ~5 мин):**
- Profile mode с CV upload (PDF)
- Flow: PDF upload → парсинг → 2-3 уточнения → save → DTW search → Spider Chart

### 3. Создана задача FEAT-055
- Файл: `tasks/features/FEAT-055-demo-video.md`
- Содержит оба сценария с разговорными репликами
- Спецификация эталонных данных для DTW контраста

### 4. Исследована возможность CV upload в e2e
- GramJS поддерживает `Api.messages.SendMedia`
- Бот уже умеет: PDF → parse_cv_to_text → converse
- Можно использовать Profile.pdf для реального demo

---

## Что осталось сделать

### Эталонные данные (для DTW демо)
- [ ] Создать JSON fixtures для 5-6 users с контрастными DTW
- [ ] Траектории: embedded → backend → web3 (под твоё резюме)
- [ ] Trails между контекстами (курсы, сертификаты)
- [ ] Feedbacks на переходах
- [ ] Import script для загрузки в Neo4j
- [ ] Unit тесты для проверки DTW метрик

### E2E скрипт с CV upload
- [ ] Добавить SendMedia для отправки PDF через GramJS
- [ ] Персона под твоё резюме (8+ лет, Lido, Web3)
- [ ] Тестирование flow: PDF → план → уточнения → search

### Запись видео
- [ ] Видео 1: Quick Search (adhoc)
- [ ] Видео 2: Cold Start с CV upload + DTW Spider Chart
- [ ] Монтаж (ускорение ожидания ответов)

### Registry
- [ ] Добавить FEAT-055 в features-registry.md

---

## Ключевые артефакты

| Артефакт | Путь |
|----------|------|
| FEAT задача | `tasks/features/FEAT-055-demo-video.md` |
| Резюме MD | `KomarovAlex2025.md` |
| Резюме PDF | `Profile.pdf` |
| E2E скрипт | `poc/e2e-variant2-llm-user-prod.ts` |
| Document handler | `src/telegram-bot/handlers/document.ts` |

---

## Ключевые инсайты

### DTW требует profile mode
- Adhoc = нет userTrajectory → нет DTW
- Profile (Cold Start) = userTrajectory ≥3 → DTW работает
- Для демо DTW нужен полный Cold Start flow

### DTW контраст через данные
Чтобы показать wow-эффект Spider Chart:
- Ideal Match: все метрики ~0.9
- Shape Only: shape ~0.9, остальное ~0.3
- Tempo Only: tempo ~0.9, остальное ~0.3
- Align Only: alignment ~0.9, остальное ~0.3

### GramJS SendMedia
```typescript
// Отправка PDF через GramJS
Api.messages.SendMedia({
  peer: BOT,
  media: Api.InputMediaUploadedDocument({...})
})
```

---

## Prompt для продолжения

```
Продолжаем работу над FEAT-055 (Demo Video).

Контекст:
- Сценарии готовы в tasks/features/FEAT-055-demo-video.md
- Нужны эталонные данные для DTW демо (5-6 users)
- E2E скрипт нужно доработать для отправки PDF

Следующий шаг: создать JSON fixtures для эталонных users с контрастными DTW метриками.

Прочитай tasks/features/FEAT-055-demo-video.md и предложи структуру fixtures.
```
