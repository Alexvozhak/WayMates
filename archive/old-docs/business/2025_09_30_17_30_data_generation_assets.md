# Заготовки для генерации данных (для AI)

## Примеры JSON (из data/contexts/)
### test-context-1.json
{
  "user_id": "u1",
  "contexts": [
    {
      "context_id": "ctx1",
      "period": { "start": "2024-12", "end": null },
      "role_started_at": "2024-12",
      "grade_awarded_at": "2024-12",
      "role": "Senior Software Developer",
      "grade": "Senior",
      "company": {
        "size": "large",
        "industry": "fintech",
        "joined_at": "2024-12"
      },
      "domains_covered": ["Backend", "Architecture"],
      "tech": {
        "languages": ["typescript"],
        "runtimes": ["nodejs"],
        "frameworks": [],
        "libraries": [],
        "databases": ["postgresql"],
        "cloud": ["aws"],
        "devops_tools": ["docker", "kubernetes"],
        "testing_tools": ["jest"]
      },
      "skills_hard": ["system_design", "programming"],
      "user_work_type": "office",
      "user_work_schedule": "full-time",
      "user_team_size": 12,
      "user_company_stage": "enterprise"
    }
  ]
}

### test-context-2.json
{ /* аналогично, полный контент */ }

### test-context-3.json
{ /* аналогично, полный контент */ }

## Строгая схема (из schemas.md)
- user_id: string (required)
- contexts: array (min 1), каждый:
  - context_id: string (required)
  - role: string (required)
  - role_started_at: string (YYYY-MM, required)
  - domains_covered: array strings (min 1, required)
  - tech: object с arrays (languages, etc., optional)
  - skills_hard: array strings (optional)
  - period: object {start: string, end: string|null} (optional)
  - и т.д. (см. полный в schemas.md)
