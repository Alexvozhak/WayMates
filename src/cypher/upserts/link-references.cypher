/* ============================================
 * БЛОК: LINK CONTEXT REFERENCES
 * ============================================
 * 
 * 🎯 НАЗНАЧЕНИЕ:
 * Связывание контекста с позициями, навыками, доменами и локацией
 * 
 * 📥 ПАРАМЕТРЫ:
 * - $context_id - ID контекста для связывания
 * - $position_name - название позиции
 * - $industry_name - название индустрии
 * - $work_domains - массив доменов работы
 * - $skills - массив навыков с категориями
 * - $original_context - данные контекста для локации
 * - $original_user - данные пользователя для гражданства
 * 
 * 📤 ВОЗВРАЩАЕТ:
 * - Ничего (выполняет связывание)
 */

MATCH (c:Context {context_id: $context_id})

// Position
MERGE (p:Position {name: $position_name})
MERGE (c)-[:HAS_POSITION]->(p)

// Industry (direct link from Context for MVP)
MERGE (i:Industry {name: $industry_name})
MERGE (c)-[:IN_INDUSTRY]->(i)

// Work domains
WITH c, $work_domains AS work_domains
UNWIND work_domains AS wdName
  MERGE (wd:WorkDomain {name: wdName})
  MERGE (c)-[:IN_WORK_DOMAIN]->(wd)

// Skills and categories
WITH c, $skills AS skills
UNWIND skills AS sk
  MERGE (sc:SkillCategory {name: sk.category})
  MERGE (s:Skill {name: sk.name})
  MERGE (s)-[:IN_CATEGORY]->(sc)
  MERGE (c)-[:USES_SKILL]->(s)

// Location nodes - УНИФИЦИРОВАННАЯ СХЕМА (name для всех)
MERGE (cty:Country {name: $original_context.country_code})  // ✅ country_code КАК name  
MERGE (ci:City {name: $original_context.city_name})         // ✅ убрали country_code из City
MERGE (ci)-[:IN_COUNTRY]->(cty)
MERGE (c)-[:IN_CITY]->(ci)
MERGE (c)-[:IN_COUNTRY]->(cty)  // ✅ ПРЯМАЯ СВЯЗЬ!

// Citizenship relations (optional, on Context) - УНИФИЦИРОВАННАЯ СХЕМА
WITH c
FOREACH (code IN $original_user.citizenships |
  MERGE (ct:Country {name: code})  // ✅ code КАК name
  MERGE (c)-[:CITIZEN_OF]->(ct)   // ✅ СВЯЗЬ ОТ CONTEXT, НЕ ОТ USER
)
