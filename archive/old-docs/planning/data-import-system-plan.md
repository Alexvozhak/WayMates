# 📋 **План реализации системы импорта данных для WayMates**

## 🎯 **Цель проекта**
Создать комплексную систему импорта справочников, ESCO данных и тестовых данных в NestJS приложение с TypeScript для платформы карьерного интеллекта WayMates.

## 📊 **Типы данных для импорта**

### **1. Справочники (Reference Data)**
- **Страны:** 42 страны (27 ЕС + UK + Россия + 9 СНГ + 5 IT рынков)
- **Языки:** 15 популярных языков в IT (en, ru, de, fr, es, it, pt, nl, sv, da, pl, cs, hu, ro, bg)
- **Уровни владения языком (CEFR):** A1-C2 (6 уровней)
- **Образование (ISCED):** 8 уровней образования
- **Валюты:** 10 основных валют IT рынков
- **IT сертификаты:** AWS, Google, Microsoft, etc.

### **2. ESCO данные (European Skills Classification)**
- **Навыки:** 13,939 записей из `esco2/skills_en.ods`
- **Профессии:** 3,039 записей из `esco2/occupations_en.ods`
- **Цифровые навыки:** 1,284 записи из `esco2/digitalSkillsCollection_en.ods`
- **Связи профессий и навыков:** 129,004 записи из `esco2/occupationSkillRelations_en.ods`
- **Иерархия навыков:** 640 записей из `esco2/skillsHierarchy_en.ods`
- **Группы навыков:** 4,086 записей из `esco2/skillGroups_en.ods`
- **ISCO классификация:** 10,442 записи из `esco2/ISCOGroups_en.ods`

### **3. Тестовые данные (Test Data)**
- **Когорты:** 4 группы пользователей (startup_developers, bigtech_developers, freelance_developers, struggling_developers)
- **Аватары:** 60-80 профилей пользователей
- **Истории карьеры:** 200-300 записей карьерного роста
- **Зарплатные истории:** динамика зарплат по годам
- **Навыки пользователей:** связи пользователей с навыками ESCO

## 🛠 **Технологический стек**

### **Основные технологии:**
- **ORM:** Prisma (уже есть в проекте)
- **Framework:** NestJS (уже есть)
- **Парсинг ODS:** `xlsx` библиотека
- **CLI:** `@nestjs/commander`
- **Валидация:** `class-validator` + `class-transformer`
- **Логирование:** `winston`

### **Зависимости для добавления:**
```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "@nestjs/commander": "^2.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/xlsx": "^0.0.36"
  }
}
```

## 📁 **Структура файлов**

```
src/
├── database/
│   ├── migrations/           # SQL миграции
│   │   ├── 01-extensions.sql
│   │   ├── 02-core-tables.sql
│   │   ├── 03-reference-tables.sql
│   │   ├── 04-esco-tables.sql
│   │   └── 05-user-enhancement.sql
│   └── seeders/
│       ├── base/
│       │   ├── base-seeder.ts
│       │   ├── countries-seeder.ts
│       │   ├── languages-seeder.ts
│       │   ├── cefr-levels-seeder.ts
│       │   ├── education-seeder.ts
│       │   ├── currencies-seeder.ts
│       │   └── certificates-seeder.ts
│       ├── esco/
│       │   ├── skills-seeder.ts
│       │   ├── occupations-seeder.ts
│       │   ├── digital-skills-seeder.ts
│       │   ├── relations-seeder.ts
│       │   ├── hierarchy-seeder.ts
│       │   ├── skill-groups-seeder.ts
│       │   └── isco-groups-seeder.ts
│       └── test-data/
│           ├── cohorts-seeder.ts
│           ├── avatars-seeder.ts
│           ├── career-paths-seeder.ts
│           └── salary-histories-seeder.ts
├── commands/
│   ├── import-all.command.ts
│   ├── import-reference.command.ts
│   ├── import-esco.command.ts
│   ├── import-test-data.command.ts
│   └── setup-database.command.ts
└── tests/
    └── data/
        ├── cohorts.json
        ├── avatars.json
        ├── career_paths.json
        └── salary_histories.json
```

## 🏗 **Архитектура системы**

### **1. Базовый Seeder класс**
```typescript
// src/database/seeders/base/base-seeder.ts
import { PrismaClient } from '@prisma/client';

export abstract class BaseSeeder {
  constructor(protected prisma: PrismaClient) {}

  abstract import(): Promise<void>;
  
  protected async batchInsert<T>(
    table: string,
    data: T[],
    batchSize: number = 1000
  ): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      await this.prisma.$transaction(async (tx) => {
        await (tx as any)[table].createMany({
          data: batch,
          skipDuplicates: true
        });
      });
      
      console.log(`✅ Импортировано ${i + batch.length}/${data.length} записей в ${table}`);
    }
  }
}
```

### **2. Seeder для справочников**
```typescript
// src/database/seeders/base/countries-seeder.ts
export class CountriesSeeder extends BaseSeeder {
  async import() {
    console.log('🌍 Импорт 42 стран...');
    
    const countries = [
      // ЕС + UK (28 стран)
      { iso_alpha_2: 'DE', iso_alpha_3: 'DEU', name_en: 'Germany', name_ru: 'Германия', region: 'EU', currency_code: 'EUR' },
      // ... остальные страны
      
      // Россия + СНГ (9 стран)
      { iso_alpha_2: 'RU', iso_alpha_3: 'RUS', name_en: 'Russia', name_ru: 'Россия', region: 'CIS', currency_code: 'RUB' },
      // ... остальные СНГ
      
      // Дополнительные IT рынки (5 стран)
      { iso_alpha_2: 'US', iso_alpha_3: 'USA', name_en: 'United States', name_ru: 'США', region: 'NA', currency_code: 'USD' },
      // ... остальные IT рынки
    ];
    
    await this.batchInsert('country', countries);
  }
}
```

### **3. Seeder для ESCO данных**
```typescript
// src/database/seeders/esco/skills-seeder.ts
export class SkillsSeeder extends BaseSeeder {
  async import() {
    console.log('📚 Импорт 13,939 навыков ESCO...');
    
    const filePath = join(process.cwd(), 'esco2', 'skills_en.ods');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const skills = data.map((row: any) => ({
      esco_uri: row.conceptUri,
      preferred_label: row.preferredLabel,
      alt_labels: row.altLabels ? row.altLabels.split(',').map((s: string) => s.trim()) : [],
      skill_type: row.skillType,
      reuse_level: row.reuseLevel,
      description: row.description || null,
      status: row.status || 'released',
      modified_date: row.modifiedDate ? new Date(row.modifiedDate) : null
    }));
    
    await this.batchInsert('esco_skill', skills, 2000);
  }
}
```

### **4. NestJS CLI команды**
```typescript
// src/commands/import-all.command.ts
@Command({ name: 'import-all', description: 'Импорт всех данных в БД' })
export class ImportAllCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(passedParam: string[], options?: ImportAllOptions): Promise<void> {
    console.log('🚀 Начинаем импорт всех данных...');
    
    try {
      // Справочники
      if (!options?.skip?.includes('reference')) {
        await this.importReferenceData();
      }
      
      // ESCO данные
      if (!options?.skip?.includes('esco')) {
        await this.importEscoData();
      }
      
      // Тестовые данные
      if (!options?.skip?.includes('test-data')) {
        await this.importTestData();
      }
      
      console.log('✅ Импорт завершен успешно!');
      
    } catch (error) {
      console.error('❌ Ошибка импорта:', error);
      throw error;
    }
  }
}
```

## 📋 **SQL миграции**

### **03-reference-tables.sql**
```sql
-- Справочники
CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iso_alpha_2 VARCHAR(2) UNIQUE NOT NULL,
    iso_alpha_3 VARCHAR(3) UNIQUE NOT NULL,
    iso_numeric INTEGER UNIQUE NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    name_ru VARCHAR(200) NOT NULL,
    region VARCHAR(50) NOT NULL,
    subregion VARCHAR(50),
    currency_code VARCHAR(3) NOT NULL,
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iso_639_1 VARCHAR(2) UNIQUE NOT NULL,
    iso_639_2 VARCHAR(3) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_ru VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cefr_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(2) UNIQUE NOT NULL,
    name_en VARCHAR(50) NOT NULL,
    name_ru VARCHAR(50) NOT NULL,
    description_en TEXT,
    description_ru TEXT,
    level_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **04-esco-tables.sql**
```sql
-- ESCO таблицы
CREATE TABLE esco_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    esco_uri VARCHAR(500) UNIQUE NOT NULL,
    preferred_label VARCHAR(500) NOT NULL,
    alt_labels TEXT[],
    hidden_labels TEXT[],
    skill_type VARCHAR(50) NOT NULL,
    reuse_level VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'released',
    modified_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE esco_occupations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    esco_uri VARCHAR(500) UNIQUE NOT NULL,
    isco_group INTEGER,
    preferred_label VARCHAR(500) NOT NULL,
    alt_labels TEXT[],
    hidden_labels TEXT[],
    description TEXT,
    code VARCHAR(20),
    status VARCHAR(50) DEFAULT 'released',
    modified_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE esco_occupation_skill_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    occupation_uri VARCHAR(500) NOT NULL,
    skill_uri VARCHAR(500) NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    skill_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (occupation_uri) REFERENCES esco_occupations(esco_uri),
    FOREIGN KEY (skill_uri) REFERENCES esco_skills(esco_uri)
);
```

## 🚀 **Команды для использования**

### **npm скрипты**
```json
{
  "scripts": {
    "db:migrate": "prisma migrate deploy",
    "db:seed:all": "nest start --entryFile import-all",
    "db:seed:reference": "nest start --entryFile import-reference",
    "db:seed:esco": "nest start --entryFile import-esco",
    "db:seed:test": "nest start --entryFile import-test-data",
    "db:setup": "npm run db:migrate && npm run db:seed:all"
  }
}
```

### **Команды CLI**
```bash
# Полная настройка БД (первый раз)
npm run db:setup

# Или по частям
npm run db:migrate          # Создать таблицы
npm run db:seed:all         # Импорт всех данных

# Детальный импорт с выбором
npx nest start --entryFile import-all -- --skip=test-data
npx nest start --entryFile import-all -- --only=esco
npx nest start --entryFile import-all -- --only=reference
```

## ⏱ **Время выполнения и размеры**

### **Справочники (2-3 минуты)**
- **Страны:** 42 записи
- **Языки:** 15 записей
- **CEFR:** 6 записей
- **Образование:** 8 записей
- **Валюты:** 10 записей
- **Сертификаты:** 50 записей

### **ESCO данные (8-12 минут)**
- **Навыки:** 13,939 записей
- **Профессии:** 3,039 записей
- **Связи:** 129,004 записи
- **Цифровые навыки:** 1,284 записи
- **Иерархия:** 640 записей
- **Группы навыков:** 4,086 записей
- **ISCO:** 10,442 записи

### **Тестовые данные (1-2 минуты)**
- **Когорты:** 4 записи
- **Аватары:** 60-80 записей
- **Истории карьеры:** 200-300 записей
- **Зарплатные истории:** 200-300 записей

### **Итого: 10-15 минут, +500MB к БД**

## 🔧 **Особенности реализации**

### **1. Prisma batch операции**
- Использование `createMany()` для эффективной вставки
- Транзакции `$transaction()` для надежности
- `skipDuplicates: true` для идемпотентности
- Batch размер 1000-2000 записей

### **2. Обработка ODS файлов**
- Использование `xlsx` библиотеки
- Парсинг по листам
- Валидация данных
- Обработка ошибок

### **3. Логирование и мониторинг**
- Прогресс импорта
- Обработка ошибок
- Статистика импорта
- Валидация данных

### **4. Идемпотентность**
- Можно запускать многократно
- `skipDuplicates: true`
- Проверка существующих данных
- Откат при ошибках

## 📝 **Порядок выполнения**

### **Этап 1: Подготовка**
1. Установить зависимости
2. Создать SQL миграции
3. Создать базовый Seeder класс

### **Этап 2: Справочники**
1. CountriesSeeder (42 страны)
2. LanguagesSeeder (15 языков)
3. CefrLevelsSeeder (6 уровней)
4. EducationSeeder (8 уровней)
5. CurrenciesSeeder (10 валют)
6. CertificatesSeeder (50 сертификатов)

### **Этап 3: ESCO данные**
1. SkillsSeeder (13,939 навыков)
2. OccupationsSeeder (3,039 профессий)
3. RelationsSeeder (129,004 связей)
4. DigitalSkillsSeeder (1,284 цифровых навыков)
5. HierarchySeeder (640 иерархий)
6. SkillGroupsSeeder (4,086 групп)
7. IscoGroupsSeeder (10,442 ISCO)

### **Этап 4: Тестовые данные**
1. CohortsSeeder (4 когорты)
2. AvatarsSeeder (60-80 аватаров)
3. CareerPathsSeeder (200-300 историй)
4. SalaryHistoriesSeeder (200-300 зарплат)

### **Этап 5: CLI команды**
1. ImportAllCommand
2. ImportReferenceCommand
3. ImportEscoCommand
4. ImportTestDataCommand
5. SetupDatabaseCommand

### **Этап 6: Тестирование**
1. Unit тесты для каждого Seeder
2. Integration тесты для CLI команд
3. E2E тесты для полного импорта
4. Performance тесты

## ✅ **Критерии готовности**

- [ ] Все SQL миграции созданы
- [ ] Все Seeder классы реализованы
- [ ] Все CLI команды работают
- [ ] Импорт проходит без ошибок
- [ ] Данные корректно сохраняются в БД
- [ ] Система идемпотентна
- [ ] Логирование работает
- [ ] Тесты проходят
- [ ] Документация написана

## 🎯 **Ожидаемый результат**

После выполнения плана будет готова система импорта, которая:
- Импортирует все справочники за 2-3 минуты
- Импортирует все ESCO данные за 8-12 минут
- Импортирует тестовые данные за 1-2 минуты
- Увеличивает размер БД на ~500MB
- Поддерживает идемпотентность
- Предоставляет CLI интерфейс
- Включает полное логирование
- Покрыта тестами

**Общее время выполнения плана: 2-3 дня разработки**
