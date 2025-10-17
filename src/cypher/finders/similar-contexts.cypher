/* ============================================
 * БЛОК 1: ПОИСК CURRENT КОНТЕКСТОВ
 * ============================================
 * * 
 * 📥 ВХОДНЫЕ ДАННЫЕ (параметры):
 * - $currentContext - текущий контекст для поиска похожих
 * - $strictSkills - обязательные навыки для фильтрации
 * - $searchConstraints - ограничения поиска
 * 
 * 📤 ВЫХОДНЫЕ ДАННЫЕ (передаются следующему блоку):
 * - dbCurrentUser: User - пользователь из БД с похожим контекстом
 * - dbCurrentContext: Context - найденный контекст похожий на запрошенный
 * - compatibilityPercent: Float - процент совместимости навыков (0-100)
 * 
 * ---
 * 
 * 💡 ЛОГИКА РАБОТЫ:
TODO
 */

/* === РЕАЛИЗАЦИЯ: УНИВЕРСАЛЬНЫЙ ПОИСК === */

// ШАГ 1: Используем единый параметр currentContext
WITH $currentContext AS requestedContext

// ШАГ 2: Ищем пользователей с подходящими контекстами в графе
// Паттерн поиска: User → HAS_CONTEXT → Context → HAS_POSITION → Position
MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)-[:HAS_POSITION]->(dbPosition:Position)
WHERE
  requestedContext IS NOT NULL AND
  
  /* ============================================
   * СЕКЦИЯ 1: ОБЯЗАТЕЛЬНОЕ ПОЛЕ
   * 
   * Это поле проверяется ВСЕГДА
   * Без совпадения по этому полю контекст не подходит
   * 
   * Паттерн: db.field = requested.field
   * ============================================ */
  dbPosition.name = requestedContext.position AND
  
  /* ============================================
   * СЕКЦИЯ 2: ОПЦИОНАЛЬНЫЕ ПРОСТЫЕ ПОЛЯ
   * 
   * Эти поля проверяются ТОЛЬКО если они заполнены в requestedContext
   * Если поле IS NULL → пропускаем проверку (считаем что подходит любое значение)
   * 
   * Паттерн: (requested.field IS NULL OR db.field = requested.field)
   * ============================================ */
  
  // Условия работы: удаленка/офис/гибрид (плоская схема)
  (requestedContext.work_type IS NULL OR
   dbCurrentContext.work_type = requestedContext.work_type) AND
   
  
  /* ============================================
   * СЕКЦИЯ 3: ОПЦИОНАЛЬНЫЕ МАССИВЫ
   * 
   * Эти поля содержат массивы/списки значений
   * Проверяем что ВСЕ элементы из запроса есть у контекста в БД
   * 
   * Паттерн: (array IS NULL OR all(item IN array WHERE EXISTS {...}))
   * 
   * Логика:
   * - Если массив IS NULL или пустой → пропускаем проверку
   * - Если массив заполнен → проверяем каждый элемент через all()
   * - all() = true только если ВСЕ элементы найдены в графе
   * ============================================ */
  
  // Домены работы (например: backend, frontend, mobile)
  (requestedContext.domains IS NULL OR
   all(
     d IN requestedContext.domains
     WHERE EXISTS {
       MATCH (dbCurrentContext)-[:IN_WORK_DOMAIN]->(wd:WorkDomain {name: d})
     }
   )) AND
  
  /* ============================================
   * СЕКЦИЯ 4: STRICT SKILLS (ОБЯЗАТЕЛЬНЫЕ НАВЫКИ)
   * 
   * Это особая категория навыков из параметра $strictSkills
   * Они ВСЕГДА обязательны
   * 
   * Используется для жесткой фильтрации по ключевым навыкам
   * Например: "обязательно Python" или "обязательно опыт с Kubernetes"
   * ============================================ */
  all(
    s IN $strictSkills
    WHERE EXISTS {
      MATCH (dbCurrentContext)-[:USES_SKILL]->(skill:Skill {name: s})
    }
  )

// ШАГ 3: Вычисляем процент совместимости по навыкам
// Это метрика качества совпадения навыков из requestedContext с навыками найденного контекста
WITH dbCurrentUser, dbCurrentContext, requestedContext,
     CASE 
       // Если навыки не указаны → считаем 100% совместимость (нет требований)
       WHEN requestedContext.skills IS NULL OR size(requestedContext.skills) = 0 
       THEN 100.0
       
       // Иначе считаем процент: (найденные навыки / запрошенные навыки) * 100
       ELSE toFloat(size([
         skill IN requestedContext.skills
         WHERE EXISTS {
           MATCH (dbCurrentContext)-[:USES_SKILL]->(s:Skill {name: skill})
         }
       ])) / size(requestedContext.skills) * 100.0
     END AS compatibilityPercent

// 🔄 Передаем данные следующему блоку через WITH
// Отфильтровываем NULL значения (на случай если ничего не нашлось)
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent 
WHERE dbCurrentUser IS NOT NULL
