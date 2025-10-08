https://www.digitalocean.com/# JSON Schema для контекста пользователя WayMates

## 🎯 Обзор

Эта JSON-схема определяет полную структуру контекста пользователя для платформы WayMates - data-driven career intelligence платформы. Схема покрывает все бизнес-фичи: карьерные оси, навыки, ограничения, цели, и поддерживает avatar matching и career intelligence.

## 📋 Полная JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://waymates.ai/schemas/user-context.json",
  "title": "WayMates User Context Schema",
  "description": "Complete user context schema for data-driven career intelligence platform",
  "type": "object",
  "required": [
    "id",
    "userId", 
    "version",
    "isCurrent",
    "currentSituation",
    "constraints",
    "goals",
    "careerAxis",
    "skills",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Уникальный ID контекста"
    },
    "userId": {
      "type": "string", 
      "format": "uuid",
      "description": "ID пользователя"
    },
    "version": {
      "type": "integer",
      "minimum": 1,
      "description": "Версия контекста для версионирования"
    },
    "isCurrent": {
      "type": "boolean",
      "description": "Текущий ли это контекст пользователя"
    },
    "currentSituation": {
      "type": "string",
      "minLength": 10,
      "maxLength": 2000,
      "description": "Текстовое описание текущей роли/позиции"
    },
    "changeReason": {
      "type": "string",
      "maxLength": 500,
      "description": "Причина изменения контекста"
    },
    "constraints": {
      "$ref": "#/definitions/UserConstraints"
    },
    "goals": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/UserGoal"
      },
      "minItems": 1,
      "description": "Список целей пользователя"
    },
    "careerAxis": {
      "$ref": "#/definitions/CareerAxisAnalysis"
    },
    "skills": {
      "$ref": "#/definitions/UserSkills"
    },
    "personalInfo": {
      "$ref": "#/definitions/PersonalInfo"
    },
    "preferences": {
      "$ref": "#/definitions/UserPreferences"
    },
    "activeContext": {
      "$ref": "#/definitions/ActiveContext"
    },
    "careerHistory": {
      "$ref": "#/definitions/CareerHistory"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "Дата создания контекста"
    },
    "updatedAt": {
      "type": "string", 
      "format": "date-time",
      "description": "Дата последнего обновления"
    }
  },
  "definitions": {
    "UserConstraints": {
      "type": "object",
      "required": ["budget", "timeline", "family", "education"],
      "properties": {
        "budget": {
          "type": "number",
          "minimum": 0,
          "description": "Бюджет на обучение (руб/месяц)"
        },
        "timeline": {
          "type": "number",
          "minimum": 1,
          "maximum": 60,
          "description": "Желаемый срок достижения цели (месяцы)"
        },
        "family": {
          "type": "boolean",
          "description": "Есть ли семья/дети"
        },
        "education": {
          "type": "boolean", 
          "description": "Нужно ли формальное образование"
        },
        "location": {
          "type": "string",
          "maxLength": 100,
          "description": "Текущее местоположение"
        },
        "workSchedule": {
          "type": "string",
          "enum": ["full-time", "part-time", "flexible"],
          "description": "График работы"
        },
        "learningStyle": {
          "type": "string",
          "enum": ["self-paced", "structured", "mentored"],
          "description": "Стиль обучения"
        },
        "riskTolerance": {
          "type": "string",
          "enum": ["low", "medium", "high"],
          "description": "Толерантность к риску"
        },
        "stabilityPreference": {
          "type": "string",
          "enum": ["stable", "flexible", "adventurous"],
          "description": "Предпочтение стабильности"
        }
      }
    },
    "UserGoal": {
      "type": "object",
      "required": ["targetRole", "priority", "motivation"],
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "ID цели"
        },
        "targetRole": {
          "type": "string",
          "minLength": 3,
          "maxLength": 200,
          "description": "Целевая роль"
        },
        "targetContext": {
          "$ref": "#/definitions/TargetContext"
        },
        "motivation": {
          "type": "string",
          "minLength": 10,
          "maxLength": 1000,
          "description": "Мотивация достижения цели"
        },
        "priority": {
          "type": "string",
          "enum": ["high", "medium", "low"],
          "description": "Приоритет цели"
        },
        "deadline": {
          "type": "string",
          "format": "date",
          "description": "Желаемый срок достижения"
        },
        "alternatives": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 200
          },
          "description": "Альтернативные цели"
        },
        "isAchieved": {
          "type": "boolean",
          "default": false,
          "description": "Достигнута ли цель"
        },
        "achievedAt": {
          "type": "string",
          "format": "date-time",
          "description": "Дата достижения цели"
        }
      }
    },
    "TargetContext": {
      "type": "object",
      "properties": {
        "requiredSkills": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SkillRequirement"
          },
          "description": "Требуемые навыки"
        },
        "preferredSkills": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SkillRequirement"
          },
          "description": "Желательные навыки"
        },
        "experienceLevel": {
          "type": "string",
          "enum": ["junior", "middle", "senior", "lead", "expert"],
          "description": "Требуемый уровень опыта"
        },
        "industry": {
          "type": "string",
          "maxLength": 100,
          "description": "Отрасль"
        },
        "companySize": {
          "type": "string",
          "enum": ["startup", "mid", "enterprise"],
          "description": "Размер компании"
        },
        "companyStage": {
          "type": "string",
          "enum": ["Series A", "Series B", "Series C", "IPO", "Enterprise"],
          "description": "Стадия компании"
        },
        "location": {
          "type": "string",
          "maxLength": 100,
          "description": "Желаемое местоположение"
        },
        "salaryExpectation": {
          "type": "number",
          "minimum": 0,
          "description": "Ожидаемая зарплата (USD/год)"
        },
        "workType": {
          "type": "string",
          "enum": ["remote", "hybrid", "office"],
          "description": "Тип работы"
        }
      }
    },
    "SkillRequirement": {
      "type": "object",
      "required": ["skillId", "skillName", "requiredLevel", "isCritical"],
      "properties": {
        "skillId": {
          "type": "string",
          "description": "ESCO ID навыка"
        },
        "skillName": {
          "type": "string",
          "maxLength": 200,
          "description": "Название навыка"
        },
        "requiredLevel": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5,
          "description": "Требуемый уровень (1-5)"
        },
        "isCritical": {
          "type": "boolean",
          "description": "Критично ли для роли"
        },
        "yearsExperience": {
          "type": "number",
          "minimum": 0,
          "description": "Требуемый опыт в годах"
        }
      }
    },
    "CareerAxisAnalysis": {
      "type": "object",
      "required": ["width", "depth", "vertical", "recommendedAxis", "currentRole", "experienceYears"],
      "properties": {
        "width": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Рост по ширине (% освоенных доменов)"
        },
        "depth": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Рост по глубине (уровень экспертизы)"
        },
        "vertical": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Рост по вертикали (размер команды)"
        },
        "recommendedAxis": {
          "type": "string",
          "enum": ["width", "depth", "vertical", "choice"],
          "description": "Рекомендуемая ось развития"
        },
        "currentRole": {
          "type": "string",
          "maxLength": 200,
          "description": "Текущая роль"
        },
        "experienceYears": {
          "type": "number",
          "minimum": 0,
          "maximum": 50,
          "description": "Общий опыт работы в годах"
        },
        "axisProgression": {
          "type": "object",
          "properties": {
            "width": {
              "type": "object",
              "properties": {
                "domainsCovered": {
                  "type": "array",
                  "items": {"type": "string"}
                },
                "totalDomains": {
                  "type": "array", 
                  "items": {"type": "string"}
                },
                "coveragePercentage": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100
                },
                "readyForSwitch": {
                  "type": "boolean"
                }
              }
            },
            "depth": {
              "type": "object",
              "properties": {
                "currentTier": {
                  "type": "integer",
                  "minimum": 0
                },
                "complexityLevel": {
                  "type": "string",
                  "enum": ["Junior", "Middle", "Senior", "Lead", "Expert"]
                },
                "skillsAtTier": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            },
            "vertical": {
              "type": "object",
              "properties": {
                "teamSize": {
                  "type": "integer",
                  "minimum": 0
                },
                "managementExperienceMonths": {
                  "type": "integer",
                  "minimum": 0
                },
                "influenceScope": {
                  "type": "string",
                  "enum": ["Individual", "Team", "Department", "Company"]
                }
              }
            }
          }
        }
      }
    },
    "UserSkills": {
      "type": "object",
      "required": ["technicalSkills", "softSkills"],
      "properties": {
        "technicalSkills": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SkillLevel"
          },
          "description": "Технические навыки"
        },
        "softSkills": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SkillLevel"
          },
          "description": "Мягкие навыки"
        },
        "languages": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/LanguageLevel"
          },
          "description": "Языки программирования"
        },
        "frameworks": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/FrameworkLevel"
          },
          "description": "Фреймворки и библиотеки"
        },
        "methodologies": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/MethodologyLevel"
          },
          "description": "Методологии работы"
        }
      }
    },
    "SkillLevel": {
      "type": "object",
      "required": ["skillId", "skillName", "level", "yearsExperience", "confidence"],
      "properties": {
        "skillId": {
          "type": "string",
          "description": "ESCO ID навыка"
        },
        "skillName": {
          "type": "string",
          "maxLength": 200,
          "description": "Название навыка"
        },
        "level": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5,
          "description": "Уровень владения (1-5)"
        },
        "yearsExperience": {
          "type": "number",
          "minimum": 0,
          "maximum": 50,
          "description": "Годы опыта"
        },
        "lastUsed": {
          "type": "string",
          "format": "date",
          "description": "Когда последний раз использовался"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Уверенность в навыке (0-100%)"
        },
        "isActive": {
          "type": "boolean",
          "default": true,
          "description": "Активно ли используется навык"
        },
        "learningProgress": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Прогресс изучения (%)"
        }
      }
    },
    "LanguageLevel": {
      "allOf": [
        {"$ref": "#/definitions/SkillLevel"},
        {
          "type": "object",
          "properties": {
            "languageType": {
              "type": "string",
              "enum": ["programming", "natural"],
              "description": "Тип языка"
            },
            "paradigm": {
              "type": "string",
              "maxLength": 100,
              "description": "Парадигма программирования"
            }
          }
        }
      ]
    },
    "FrameworkLevel": {
      "allOf": [
        {"$ref": "#/definitions/SkillLevel"},
        {
          "type": "object",
          "properties": {
            "frameworkType": {
              "type": "string",
              "enum": ["frontend", "backend", "mobile", "data", "devops"],
              "description": "Тип фреймворка"
            },
            "dependencies": {
              "type": "array",
              "items": {"type": "string"},
              "description": "Зависимые технологии"
            }
          }
        }
      ]
    },
    "MethodologyLevel": {
      "allOf": [
        {"$ref": "#/definitions/SkillLevel"},
        {
          "type": "object",
          "properties": {
            "methodologyType": {
              "type": "string",
              "enum": ["agile", "waterfall", "devops", "design", "management"],
              "description": "Тип методологии"
            },
            "certification": {
              "type": "string",
              "maxLength": 200,
              "description": "Сертификация"
            }
          }
        }
      ]
    },
    "PersonalInfo": {
      "type": "object",
      "properties": {
        "age": {
          "type": "integer",
          "minimum": 16,
          "maximum": 80,
          "description": "Возраст"
        },
        "gender": {
          "type": "string",
          "enum": ["male", "female", "other", "prefer-not-to-say"],
          "description": "Пол"
        },
        "education": {
          "type": "string",
          "enum": ["high-school", "bachelor", "master", "phd", "other"],
          "description": "Образование"
        },
        "location": {
          "type": "string",
          "maxLength": 100,
          "description": "Местоположение"
        },
        "timezone": {
          "type": "string",
          "maxLength": 50,
          "description": "Часовой пояс"
        },
        "nationality": {
          "type": "string",
          "maxLength": 100,
          "description": "Национальность"
        }
      }
    },
    "UserPreferences": {
      "type": "object",
      "properties": {
        "language": {
          "type": "string",
          "enum": ["ru", "en"],
          "default": "ru",
          "description": "Предпочитаемый язык"
        },
        "notifications": {
          "type": "boolean",
          "default": true,
          "description": "Включены ли уведомления"
        },
        "dataSharing": {
          "type": "boolean",
          "default": false,
          "description": "Согласие на использование данных"
        },
        "marketing": {
          "type": "boolean",
          "default": false,
          "description": "Согласие на маркетинговые сообщения"
        },
        "privacy": {
          "type": "string",
          "enum": ["public", "private"],
          "default": "private",
          "description": "Уровень приватности"
        }
      }
    },
    "ActiveContext": {
      "type": "object",
      "properties": {
        "timePerWeek": {
          "type": "number",
          "minimum": 0,
          "maximum": 40,
          "description": "Часов в неделю на обучение"
        },
        "budgetPerMonth": {
          "type": "number",
          "minimum": 0,
          "description": "Бюджет в месяц на обучение (руб)"
        },
        "preferredLearningTime": {
          "type": "string",
          "enum": ["morning", "afternoon", "evening", "weekend"],
          "description": "Предпочитаемое время обучения"
        },
        "learningStyle": {
          "type": "string",
          "enum": ["visual", "auditory", "kinesthetic", "reading"],
          "description": "Стиль обучения"
        },
        "motivationLevel": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5,
          "description": "Уровень мотивации (1-5)"
        },
        "userFactor": {
          "type": "number",
          "minimum": 0.1,
          "maximum": 3.0,
          "default": 1.0,
          "description": "Персональный множитель скорости обучения"
        }
      }
    },
    "CareerHistory": {
      "type": "object",
      "properties": {
        "careerTransitions": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/CareerTransition"
          },
          "description": "История карьерных переходов"
        },
        "learningJourneys": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/LearningJourney"
          },
          "description": "Истории обучения"
        },
        "achievements": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/Achievement"
          },
          "description": "Достижения и артефакты"
        },
        "satisfactionScores": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SatisfactionScore"
          },
          "description": "История удовлетворенности ролями"
        }
      }
    },
    "CareerTransition": {
      "type": "object",
      "required": ["fromRole", "toRole", "company", "startDate", "monthsDuration", "axis", "success"],
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "ID перехода"
        },
        "fromRole": {
          "type": "string",
          "maxLength": 200,
          "description": "Предыдущая роль"
        },
        "toRole": {
          "type": "string",
          "maxLength": 200,
          "description": "Новая роль"
        },
        "company": {
          "type": "string",
          "maxLength": 200,
          "description": "Компания"
        },
        "startDate": {
          "type": "string",
          "format": "date",
          "description": "Дата начала"
        },
        "endDate": {
          "type": "string",
          "format": "date",
          "description": "Дата окончания (если завершена)"
        },
        "monthsDuration": {
          "type": "integer",
          "minimum": 1,
          "description": "Продолжительность в месяцах"
        },
        "keySkillsLearned": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Ключевые навыки, изученные"
        },
        "axis": {
          "type": "string",
          "enum": ["width", "depth", "vertical"],
          "description": "Ось роста"
        },
        "success": {
          "type": "boolean",
          "description": "Успешность перехода"
        },
        "satisfaction": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "description": "Удовлетворенность (1-10)"
        },
        "salaryChange": {
          "type": "number",
          "description": "Изменение зарплаты (%)"
        }
      }
    },
    "LearningJourney": {
      "type": "object",
      "required": ["skillId", "skillName", "startDate", "learningMethod", "success"],
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "ID путешествия"
        },
        "skillId": {
          "type": "string",
          "description": "ESCO ID навыка"
        },
        "skillName": {
          "type": "string",
          "maxLength": 200,
          "description": "Название навыка"
        },
        "startDate": {
          "type": "string",
          "format": "date",
          "description": "Дата начала изучения"
        },
        "endDate": {
          "type": "string",
          "format": "date",
          "description": "Дата завершения"
        },
        "hoursSpent": {
          "type": "number",
          "minimum": 0,
          "description": "Часов потрачено"
        },
        "learningMethod": {
          "type": "string",
          "enum": ["course", "project", "mentoring", "self-study"],
          "description": "Метод обучения"
        },
        "resources": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Использованные ресурсы"
        },
        "cost": {
          "type": "number",
          "minimum": 0,
          "description": "Стоимость обучения"
        },
        "success": {
          "type": "boolean",
          "description": "Успешность изучения"
        },
        "difficulty": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5,
          "description": "Сложность (1-5)"
        },
        "prerequisites": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Предварительные навыки"
        }
      }
    },
    "Achievement": {
      "type": "object",
      "required": ["id", "title", "description", "type", "date"],
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "ID достижения"
        },
        "title": {
          "type": "string",
          "maxLength": 200,
          "description": "Название достижения"
        },
        "description": {
          "type": "string",
          "maxLength": 1000,
          "description": "Описание"
        },
        "type": {
          "type": "string",
          "enum": ["certification", "project", "award", "publication"],
          "description": "Тип достижения"
        },
        "date": {
          "type": "string",
          "format": "date",
          "description": "Дата получения"
        },
        "issuer": {
          "type": "string",
          "maxLength": 200,
          "description": "Кто выдал"
        },
        "skills": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Связанные навыки"
        },
        "evidence": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Ссылки на доказательства"
        },
        "verified": {
          "type": "boolean",
          "default": false,
          "description": "Проверено ли"
        }
      }
    },
    "SatisfactionScore": {
      "type": "object",
      "required": ["role", "score", "date", "durationMonths"],
      "properties": {
        "role": {
          "type": "string",
          "maxLength": 200,
          "description": "Роль"
        },
        "score": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "description": "Оценка удовлетворенности (1-10)"
        },
        "date": {
          "type": "string",
          "format": "date",
          "description": "Дата оценки"
        },
        "durationMonths": {
          "type": "integer",
          "minimum": 1,
          "description": "Продолжительность в роли (месяцы)"
        }
      }
    }
  }
}
```

## 🎯 Ключевые особенности схемы

### **1. Полная поддержка бизнес-фич WayMates**
- ✅ **Карьерные оси**: width, depth, vertical с детальной прогрессией
- ✅ **ESCO интеграция**: все навыки привязаны к ESCO ID
- ✅ **Avatar matching**: поддержка поиска похожих пользователей
- ✅ **Career intelligence**: анализ готовности к росту

### **2. Версионирование контекстов**
- Поддержка множественных версий контекста пользователя
- Отслеживание изменений и причин обновления
- История карьерного развития

### **3. Гибкая структура навыков**
- Технические навыки, мягкие навыки, языки, фреймворки
- Уровни владения (1-5) с ESCO стандартами
- Прогресс изучения и уверенность

### **4. Целеполагание**
- Множественные цели с приоритетами
- Детальные требования к целевым ролям
- Альтернативные варианты развития

### **5. Ограничения и предпочтения**
- Бюджетные и временные ограничения
- Стили обучения и предпочтения
- Толерантность к риску

## 📊 Примеры использования

### **Пример 1: Middle React Developer**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "version": 1,
  "isCurrent": true,
  "currentSituation": "Middle React Developer с 2 годами опыта, работаю в Series A стартапе, хочу развиваться в техническом направлении",
  "constraints": {
    "budget": 15000,
    "timeline": 12,
    "family": false,
    "education": false,
    "location": "Москва",
    "workSchedule": "full-time",
    "learningStyle": "structured",
    "riskTolerance": "medium"
  },
  "goals": [
    {
      "id": "goal-1",
      "targetRole": "Senior React Developer",
      "motivation": "Хочу увеличить зарплату и стать экспертом в React",
      "priority": "high",
      "deadline": "2024-12-31",
      "targetContext": {
        "requiredSkills": [
          {
            "skillId": "react-advanced",
            "skillName": "React Advanced Patterns",
            "requiredLevel": 4,
            "isCritical": true,
            "yearsExperience": 3
          }
        ],
        "experienceLevel": "senior",
        "companySize": "mid",
        "salaryExpectation": 200000
      }
    }
  ],
  "careerAxis": {
    "width": 65,
    "depth": 40,
    "vertical": 20,
    "recommendedAxis": "depth",
    "currentRole": "Middle React Developer",
    "experienceYears": 2
  },
  "skills": {
    "technicalSkills": [
      {
        "skillId": "react-basic",
        "skillName": "React.js",
        "level": 3,
        "yearsExperience": 2,
        "confidence": 80,
        "isActive": true
      }
    ]
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### **Пример 2: Senior Developer выбирает трек**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "userId": "123e4567-e89b-12d3-a456-426614174001",
  "version": 3,
  "isCurrent": true,
  "currentSituation": "Senior Backend Developer с 4 годами опыта, готов к выбору между техническим и управленческим треком",
  "constraints": {
    "budget": 25000,
    "timeline": 18,
    "family": true,
    "education": false,
    "location": "Санкт-Петербург",
    "workSchedule": "full-time",
    "learningStyle": "mentored",
    "riskTolerance": "low"
  },
  "goals": [
    {
      "id": "goal-1",
      "targetRole": "Tech Lead",
      "motivation": "Хочу техническое лидерство без полного перехода в менеджмент",
      "priority": "high"
    },
    {
      "id": "goal-2", 
      "targetRole": "Engineering Manager",
      "motivation": "Альтернативный путь через управление командой",
      "priority": "medium"
    }
  ],
  "careerAxis": {
    "width": 80,
    "depth": 75,
    "vertical": 30,
    "recommendedAxis": "choice",
    "currentRole": "Senior Backend Developer",
    "experienceYears": 4
  },
  "skills": {
    "technicalSkills": [
      {
        "skillId": "nodejs-advanced",
        "skillName": "Node.js Advanced",
        "level": 5,
        "yearsExperience": 3,
        "confidence": 90
      }
    ],
    "softSkills": [
      {
        "skillId": "mentoring",
        "skillName": "Mentoring",
        "level": 3,
        "yearsExperience": 1,
        "confidence": 70
      }
    ]
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

## 🔧 Валидация и использование

### **Валидация с помощью JSON Schema**
```javascript
import Ajv from 'ajv';
import userContextSchema from './user-context-schema.json';

const ajv = new Ajv();
const validate = ajv.compile(userContextSchema);

// Валидация контекста пользователя
const isValid = validate(userContext);
if (!isValid) {
  console.log(validate.errors);
}
```

### **TypeScript типы**
```typescript
// Автогенерация TypeScript типов из JSON Schema
// Используйте tools типа json-schema-to-typescript
export interface UserContext {
  id: string;
  userId: string;
  version: number;
  isCurrent: boolean;
  currentSituation: string;
  constraints: UserConstraints;
  goals: UserGoal[];
  careerAxis: CareerAxisAnalysis;
  skills: UserSkills;
  // ... остальные поля
}
```

## 🎯 Интеграция с WayMates

Эта схема полностью совместима с:
- ✅ **PostgreSQL схемой** из `database/postgres/schemas/02-core-tables.sql`
- ✅ **Career Intelligence модулем** для анализа карьерных осей
- ✅ **Avatar matching** для поиска похожих пользователей
- ✅ **ESCO skills framework** для стандартизации навыков
- ✅ **LightRAG** для векторного поиска и анализа

Схема готова к использованию в production и поддерживает все текущие и планируемые бизнес-фичи WayMates.

