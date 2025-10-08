# Структуры данных для unified поиска когорты

## 1. Контекст с precomputed полями

```typescript
interface OptimizedContext {
  // Базовые поля
  context_id: string;                           // уникальный ID
  creation_reason: string;                      // тип создания контекста
  
  // Профессиональная идентичность
  role: string;                                 // точное совпадение в фильтрах
  grade: string;                               // точное совпадение в фильтрах  
  domains: string[];                           // пересечение в фильтрах
  skills: Skill[];                             // расчет coverage в метриках
  
  // Precomputed опыт (для быстрых фильтров)
  accumulated_work_experience_months: number;   // общий стаж для порогов
  role_started_at: string;                     // temporal matching в фильтрах
  grade_started_at: string;                    // temporal matching в фильтрах
  
  // Контекст работы
  company_size: string;                        // метрики similarity
  company_industry: string;                    // бонусы в scoring
  work_type: string;                          // remote/office для метрик
  
  // География  
  location_country: string;                    // жесткий фильтр или бонус
  location_city: string;                      // жесткий фильтр или бонус
}
```

## 2. Параметры первичного отсева

```typescript
interface PrimaryFilterParams {
  // Точные совпадения
  target_role: string;                         // обязательное равенство
  target_grade: string;                        // обязательное равенство
  required_domains: string[];                  // минимум одно пересечение
  
  // Числовые пороги
  min_experience_months: number;               // минимальный общий стаж
  max_experience_months: number;               // максимальный общий стаж
  max_timing_diff_months: number;             // допустимая разница в датах
  
  // Географические фильтры
  require_country_match: boolean;              // обязательность страны
  require_city_match: boolean;                // обязательность города
  target_country?: string;                    // требуемая страна
  target_city?: string;                       // требуемый город
}
```

## 3. Метрики качества для ранжирования

```typescript
interface QualityMetrics {
  // Навыки и компетенции (0.0-1.0)
  skills_coverage: number;                     // процент совпавших навыков
  skill_categories_match: number;              // совпадение типов технологий
  
  // Временная точность (0.0-1.0)  
  experience_precision: number;                // близость по стажу
  role_timing_relevancy: number;              // актуальность начала роли
  grade_timing_relevancy: number;             // актуальность получения грейда
  
  // Контекстуальные бонусы (0.0-1.0)
  company_size_similarity: number;            // схожесть размера компаний
  industry_bonus: number;                     // бонус за схожую индустрию
  work_type_compatibility: number;            // совместимость типа работы
  
  // Географические бонусы (0.0-0.15)
  country_bonus: number;                      // 0.1 за ту же страну
  city_bonus: number;                         // 0.05 за тот же город
}
```

## 4. Возвращаемый результат поиска

```typescript
interface UnifiedSearchResult {
  // Идентификация найденного пользователя
  user_id: string;                            // ID пользователя с опытом
  from_context_id: string;                    // контекст похожий на current
  to_context_id: string;                      // контекст похожий на target
  
  // Путь развития
  trail_path: Trail[];                        // последовательность обучения
  trail_count: number;                        // количество шагов в пути
  
  // Совместимость контекстов
  current_compatibility: QualityMetrics;      // насколько подходит from_context
  target_compatibility: QualityMetrics;      // насколько подходит to_context
  
  // Качество пути развития
  path_total_cost: number;                    // общая стоимость обучения
  path_total_duration_weeks: number;          // общая длительность
  path_average_rating: number;                // средний рейтинг курсов
  
  // Итоговые метрики для сортировки
  overall_compatibility_score: number;        // weighted sum всех метрик
  path_feasibility_score: number;            // реалистичность пути
  final_ranking_score: number;               // итоговый балл для сортировки
}
```

## 5. Алгоритм работы

1. **Первичный отсев**: WHERE по PrimaryFilterParams - исключаем несовместимых
2. **Поиск путей**: среди прошедших ищем trail_path между контекстами
3. **Расчет метрик**: для найденных путей считаем QualityMetrics
4. **Ранжирование**: сортируем по final_ranking_score
5. **Возврат**: топ N результатов в формате UnifiedSearchResult

