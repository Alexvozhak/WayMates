# ClickHouse Testing Strategy для WayMates Career Intelligence

## Обзор ClickHouse в WayMates

ClickHouse используется для **OLAP аналитики** в WayMates:
- **Time-series данные**: study_sessions, career_analytics, skill_saturation_analysis
- **Агрегация**: cohort statistics, market benchmarks, progression patterns
- **Аналитические запросы**: skill saturation detection, vertical growth analysis
- **Performance**: быстрые запросы по большим объемам данных

## Стратегия тестирования ClickHouse

### 1. **Unit Tests** - НЕ подходят для ClickHouse
❌ **Почему не unit тесты:**
- ClickHouse - это база данных, не бизнес-логика
- Unit тесты изолируют код, но ClickHouse требует реальных данных
- Нет смысла тестировать SQL запросы в изоляции

### 2. **Integration Tests** - Основной подход ✅
**Почему integration тесты:**
- Тестируем реальные SQL запросы с реальными данными
- Проверяем производительность на больших объемах
- Валидируем корректность агрегаций и аналитики

### 3. **Functional Tests** - Критично важно ✅
**Почему functional тесты:**
- Тестируем end-to-end аналитические сценарии
- Проверяем бизнес-логику аналитики
- Валидируем корректность career intelligence алгоритмов

## Детальная стратегия тестирования

### **Phase 1: Data Ingestion Testing**

#### 1.1 ETL Pipeline Testing
```typescript
describe('ClickHouse ETL Pipeline', () => {
  test('should sync study_sessions from PostgreSQL', async () => {
    // Arrange
    const postgresData = await createTestStudySessions(100);
    
    // Act
    await etlService.syncStudySessions(postgresData);
    
    // Assert
    const clickhouseData = await clickhouse.query(`
      SELECT COUNT(*) as count 
      FROM study_sessions 
      WHERE session_date >= today() - 7
    `);
    expect(clickhouseData[0].count).toBe(100);
  });
  
  test('should handle data type conversions correctly', async () => {
    // Test UUID -> String conversion
    // Test JSONB -> Array conversion
    // Test timestamp timezone handling
  });
  
  test('should maintain data consistency during sync', async () => {
    // Verify no data loss
    // Verify no duplicates
    // Verify referential integrity
  });
});
```

#### 1.2 Data Quality Testing
```typescript
describe('ClickHouse Data Quality', () => {
  test('should reject invalid data types', async () => {
    const invalidData = {
      user_id: 'not-a-uuid',
      duration_hours: 'not-a-number',
      session_date: 'invalid-date'
    };
    
    await expect(clickhouse.insert('study_sessions', invalidData))
      .rejects.toThrow('Invalid data type');
  });
  
  test('should handle null values correctly', async () => {
    const dataWithNulls = {
      user_id: 'valid-uuid',
      skill_esco_id: null, // Nullable field
      duration_hours: 2.5
    };
    
    await clickhouse.insert('study_sessions', dataWithNulls);
    const result = await clickhouse.query(`
      SELECT skill_esco_id FROM study_sessions 
      WHERE user_id = 'valid-uuid'
    `);
    expect(result[0].skill_esco_id).toBeNull();
  });
});
```

### **Phase 2: Analytical Queries Testing**

#### 2.1 Skill Saturation Analysis
```typescript
describe('Skill Saturation Analysis Queries', () => {
  beforeEach(async () => {
    // Setup test data
    await insertTestData('study_sessions', [
      { user_id: 'user1', skill_esco_id: 'react', duration_hours: 10, session_date: '2024-01-01' },
      { user_id: 'user1', skill_esco_id: 'react', duration_hours: 5, session_date: '2024-01-15' },
      { user_id: 'user1', skill_esco_id: 'react', duration_hours: 2, session_date: '2024-02-01' }, // Declining
      { user_id: 'user2', skill_esco_id: 'react', duration_hours: 15, session_date: '2024-01-01' },
      { user_id: 'user2', skill_esco_id: 'react', duration_hours: 12, session_date: '2024-01-15' },
      { user_id: 'user2', skill_esco_id: 'react', duration_hours: 8, session_date: '2024-02-01' },
    ]);
  });
  
  test('should detect skill saturation correctly', async () => {
    const result = await clickhouse.query(`
      SELECT 
        user_id,
        skill_esco_id,
        avg(duration_hours) as avg_hours,
        stddevPop(duration_hours) as stddev_hours,
        (stddev_hours / avg_hours) as coefficient_variation
      FROM study_sessions 
      WHERE skill_esco_id = 'react'
      GROUP BY user_id, skill_esco_id
      HAVING coefficient_variation < 0.3 -- Saturation threshold
    `);
    
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('user1');
    expect(result[0].coefficient_variation).toBeLessThan(0.3);
  });
  
  test('should calculate skill progression trends', async () => {
    const result = await clickhouse.query(`
      SELECT 
        user_id,
        skill_esco_id,
        toStartOfMonth(session_date) as month,
        sum(duration_hours) as monthly_hours
      FROM study_sessions 
      WHERE skill_esco_id = 'react'
      GROUP BY user_id, skill_esco_id, month
      ORDER BY user_id, month
    `);
    
    // Verify trend calculation
    const user1Trend = result.filter(r => r.user_id === 'user1');
    expect(user1Trend[0].monthly_hours).toBeGreaterThan(user1Trend[2].monthly_hours); // Declining
  });
});
```

#### 2.2 Career Analytics Aggregation
```typescript
describe('Career Analytics Aggregation', () => {
  beforeEach(async () => {
    await insertTestData('career_analytics', [
      { user_id: 1, analysis_date: '2024-01-01', internal_axes: [4,5,3,1], external_metrics: [0.3,0.6,0.8], cohort_size: 15, avatar_id: 'avatar1' },
      { user_id: 2, analysis_date: '2024-01-01', internal_axes: [6,7,5,2], external_metrics: [0.7,0.8,0.9], cohort_size: 15, avatar_id: 'avatar1' },
      { user_id: 3, analysis_date: '2024-01-01', internal_axes: [5,6,4,1], external_metrics: [0.5,0.7,0.85], cohort_size: 15, avatar_id: 'avatar1' },
    ]);
  });
  
  test('should calculate cohort statistics correctly', async () => {
    const result = await clickhouse.query(`
      SELECT 
        cohort_size,
        avg(internal_axes[1]) as avg_axis_1,
        quantile(0.5)(internal_axes[1]) as median_axis_1,
        quantile(0.25)(internal_axes[1]) as q25_axis_1,
        quantile(0.75)(internal_axes[1]) as q75_axis_1
      FROM career_analytics 
      WHERE analysis_date = '2024-01-01'
      GROUP BY cohort_size
    `);
    
    expect(result[0].avg_axis_1).toBeCloseTo(5.0, 1);
    expect(result[0].median_axis_1).toBeCloseTo(5.0, 1);
    expect(result[0].q25_axis_1).toBeCloseTo(4.0, 1);
    expect(result[0].q75_axis_1).toBeCloseTo(6.0, 1);
  });
  
  test('should detect outliers in cohort data', async () => {
    const result = await clickhouse.query(`
      SELECT 
        user_id,
        internal_axes[1] as axis_1,
        (axis_1 - avg(axis_1) OVER()) / stddevPop(axis_1) OVER() as z_score
      FROM career_analytics 
      WHERE analysis_date = '2024-01-01'
      HAVING abs(z_score) > 2 -- Outlier threshold
    `);
    
    // Should detect user with axis_1 = 6 as outlier
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(2);
  });
});
```

### **Phase 3: Performance Testing**

#### 3.1 Query Performance Testing
```typescript
describe('ClickHouse Performance', () => {
  beforeEach(async () => {
    // Insert large dataset
    await insertLargeTestDataset('study_sessions', 100000);
    await insertLargeTestDataset('career_analytics', 50000);
  });
  
  test('should execute skill saturation query under 2 seconds', async () => {
    const startTime = Date.now();
    
    await clickhouse.query(`
      SELECT 
        user_id,
        skill_esco_id,
        avg(duration_hours) as avg_hours,
        count(*) as session_count
      FROM study_sessions 
      WHERE session_date >= today() - 30
      GROUP BY user_id, skill_esco_id
      HAVING session_count >= 5
    `);
    
    const executionTime = Date.now() - startTime;
    expect(executionTime).toBeLessThan(2000); // 2 seconds
  });
  
  test('should handle concurrent queries efficiently', async () => {
    const queries = Array(10).fill(null).map(() => 
      clickhouse.query('SELECT COUNT(*) FROM study_sessions')
    );
    
    const startTime = Date.now();
    await Promise.all(queries);
    const executionTime = Date.now() - startTime;
    
    expect(executionTime).toBeLessThan(5000); // 5 seconds for 10 concurrent queries
  });
});
```

#### 3.2 Memory Usage Testing
```typescript
describe('ClickHouse Memory Usage', () => {
  test('should not exceed memory limits on large aggregations', async () => {
    const result = await clickhouse.query(`
      SELECT 
        user_id,
        arrayReduce('quantile', quantiles(0.1, 0.5, 0.9)(internal_axes[1])) as percentiles
      FROM career_analytics 
      GROUP BY user_id
    `);
    
    // Verify query completed without memory errors
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
```

### **Phase 4: Data Consistency Testing**

#### 4.1 Cross-Database Consistency
```typescript
describe('PostgreSQL-ClickHouse Consistency', () => {
  test('should maintain data consistency after ETL', async () => {
    // Insert data in PostgreSQL
    const postgresData = await postgres.query(`
      INSERT INTO user_stories (user_id, raw_text, axis_1_growth) 
      VALUES ($1, $2, $3)
    `, ['user1', 'Test story', true]);
    
    // Run ETL
    await etlService.syncUserStories();
    
    // Verify in ClickHouse
    const clickhouseData = await clickhouse.query(`
      SELECT COUNT(*) as count 
      FROM career_analytics 
      WHERE user_id = 'user1'
    `);
    
    expect(clickhouseData[0].count).toBeGreaterThan(0);
  });
  
  test('should handle data updates correctly', async () => {
    // Update data in PostgreSQL
    await postgres.query(`
      UPDATE user_stories 
      SET axis_1_growth = false 
      WHERE user_id = 'user1'
    `);
    
    // Run ETL
    await etlService.syncUserStories();
    
    // Verify update in ClickHouse
    const result = await clickhouse.query(`
      SELECT internal_axes[1] as axis_1
      FROM career_analytics 
      WHERE user_id = 'user1'
      ORDER BY analysis_date DESC
      LIMIT 1
    `);
    
    expect(result[0].axis_1).toBe(0); // Updated value
  });
});
```

### **Phase 5: Business Logic Testing**

#### 5.1 Career Intelligence Algorithms
```typescript
describe('Career Intelligence ClickHouse Queries', () => {
  test('should calculate skill saturation score correctly', async () => {
    const result = await clickhouse.query(`
      WITH user_skill_stats AS (
        SELECT 
          user_id,
          skill_esco_id,
          avg(duration_hours) as avg_hours,
          stddevPop(duration_hours) as stddev_hours,
          count(*) as session_count
        FROM study_sessions 
        WHERE session_date >= today() - 90
        GROUP BY user_id, skill_esco_id
        HAVING session_count >= 3
      ),
      saturation_scores AS (
        SELECT 
          user_id,
          skill_esco_id,
          (stddev_hours / avg_hours) as coefficient_variation,
          CASE 
            WHEN coefficient_variation < 0.3 THEN 'saturated'
            WHEN coefficient_variation < 0.6 THEN 'stable'
            ELSE 'growing'
          END as saturation_status
        FROM user_skill_stats
      )
      SELECT 
        user_id,
        countIf(saturation_status = 'saturated') as saturated_skills,
        countIf(saturation_status = 'growing') as growing_skills,
        count(*) as total_skills
      FROM saturation_scores
      GROUP BY user_id
    `);
    
    // Verify business logic
    expect(result[0].saturated_skills).toBeGreaterThanOrEqual(0);
    expect(result[0].growing_skills).toBeGreaterThanOrEqual(0);
    expect(result[0].total_skills).toBe(result[0].saturated_skills + result[0].growing_skills);
  });
  
  test('should detect vertical growth readiness', async () => {
    const result = await clickhouse.query(`
      SELECT 
        user_id,
        internal_axes[3] as peer_leadership,
        internal_axes[4] as formal_leadership,
        (peer_leadership + formal_leadership) / 2 as leadership_score,
        CASE 
          WHEN leadership_score >= 6 THEN 'ready_for_management'
          WHEN leadership_score >= 4 THEN 'developing_leadership'
          ELSE 'focus_on_technical_skills'
        END as growth_recommendation
      FROM career_analytics 
      WHERE analysis_date = today()
    `);
    
    // Verify business logic
    result.forEach(row => {
      if (row.leadership_score >= 6) {
        expect(row.growth_recommendation).toBe('ready_for_management');
      } else if (row.leadership_score >= 4) {
        expect(row.growth_recommendation).toBe('developing_leadership');
      } else {
        expect(row.growth_recommendation).toBe('focus_on_technical_skills');
      }
    });
  });
});
```

## Test Data Management

### **Test Data Factory**
```typescript
class ClickHouseTestDataFactory {
  async createStudySessions(count: number, overrides: Partial<StudySession> = {}) {
    const sessions = Array(count).fill(null).map((_, i) => ({
      session_id: `session_${i}`,
      user_id: `user_${i % 10}`, // 10 users
      skill_esco_id: `skill_${i % 5}`, // 5 skills
      session_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Last 30 days
      duration_hours: Math.random() * 4 + 0.5, // 0.5-4.5 hours
      activity_type: ['course', 'coding', 'testing', 'reading'][i % 4],
      ...overrides
    }));
    
    await clickhouse.insert('study_sessions', sessions);
    return sessions;
  }
  
  async createCareerAnalytics(count: number, overrides: Partial<CareerAnalytics> = {}) {
    const analytics = Array(count).fill(null).map((_, i) => ({
      user_id: i,
      analysis_date: new Date(),
      internal_axes: [Math.random() * 10, Math.random() * 10, Math.random() * 10, Math.random() * 10],
      external_metrics: [Math.random(), Math.random(), Math.random()],
      cohort_size: 15,
      avatar_id: `avatar_${i % 3}`,
      ...overrides
    }));
    
    await clickhouse.insert('career_analytics', analytics);
    return analytics;
  }
}
```

## Test Environment Setup

### **Docker Compose для тестов**
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  clickhouse-test:
    image: clickhouse/clickhouse-server:latest
    ports:
      - "8124:8123"
    environment:
      CLICKHOUSE_DB: waymates_test
    volumes:
      - ./database/clickhouse/init:/docker-entrypoint-initdb.d
      - ./database/clickhouse/schemas:/schemas
    command: clickhouse-server --config-file=/etc/clickhouse-server/config.xml
```

### **Test Configuration**
```typescript
// test/config/clickhouse.test.config.ts
export const clickhouseTestConfig = {
  host: 'localhost',
  port: 8124,
  database: 'waymates_test',
  username: 'default',
  password: '',
  compression: false, // Disable for testing
  log: {
    level: 'debug'
  }
};
```

## Метрики качества ClickHouse тестов

### **Performance Metrics**
- **Query execution time**: <2s для аналитических запросов
- **Concurrent queries**: 10+ одновременных запросов
- **Memory usage**: <1GB для тестовых данных
- **Data ingestion speed**: >1000 records/second

### **Data Quality Metrics**
- **Data consistency**: 100% между PostgreSQL и ClickHouse
- **Data completeness**: 0% data loss
- **Query accuracy**: 100% корректных результатов
- **Error handling**: 100% покрытие error cases

### **Business Logic Metrics**
- **Algorithm accuracy**: >95% корректных career intelligence расчетов
- **Edge case coverage**: 100% edge cases покрыты
- **Regression prevention**: 0% regression bugs

---

**Статус**: Готов к реализации  
**Приоритет**: High (критично для аналитики)  
**Следующий этап**: Setup test environment + первые integration тесты






