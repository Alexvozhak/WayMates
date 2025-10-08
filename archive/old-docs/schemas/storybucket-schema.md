```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://waymates.io/schemas/storybucket",
  "title": "StoryBucket Schema (MVP)",
  "description": "JSON Schema for user career histories in Neo4j: CSR, Bucket, Story with atomic facts.",

  "type": "object",
  "properties": {},

  "$defs": {
    "IsoDate": { "type": "string", "format": "date-time" },
    "Money": {
      "type": "object",
      "properties": {
        "amount": { "type": "number", "minimum": 0 },
        "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
        "eur_at_ts": { "type": ["number", "null"], "description": "EUR equivalent at timestamp, required if currency != EUR" }
      },
      "required": ["amount", "currency"]
    },
    "Period": {
      "type": "object",
      "properties": {
        "start_date": { "$ref": "#/$defs/IsoDate" },
        "end_date": { "$ref": "#/$defs/IsoDate" },
        "granularity": { "enum": ["day", "month", "year"] },
        "approx": { "type": "boolean", "default": true }
      },
      "required": ["start_date", "end_date", "granularity"],
      "allOf": [{ "if": { "properties": { "start_date": {} } }, "then": { "properties": { "end_date": { "not": { "format": "date-time" } } } } }]
    },
    "Schedule": {
      "type": "object",
      "properties": {
        "freq": { "enum": ["weekly", "daily", "self_paced"] },
        "sessions_per_week": { "type": "integer", "minimum": 1, "maximum": 7 },
        "typical_session_minutes": { "type": "integer", "minimum": 30, "maximum": 240 },
        "approx": { "type": "boolean" }
      },
      "required": ["freq", "sessions_per_week", "typical_session_minutes"]
    },
    "SkillShare": {
      "type": "object",
      "properties": {
        "skill_id": { "type": "string" }, // ESCO ID
        "share_hours": { "type": "number", "minimum": 0, "maximum": 1 },
        "share_cost": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "required": ["skill_id"]
    },
    "ResourceShare": {
      "type": "object",
      "properties": {
        "resource_id": { "type": "string" }, // Canonical URL hash
        "hours_share": { "type": ["number", "null"] },
        "cost_share": { "type": ["number", "null"] }
      },
      "required": ["resource_id"]
    },
    "Evidence": { "type": "array", "items": { "type": "string" }, "maxItems": 5 }, // URLs/certs
    "StatusEnum": { "enum": ["draft", "confirmed", "verified"] },
    "PrivacyEnum": { "enum": ["private", "cohort", "public_anon"] },
    "ModalityEnum": { "enum": ["course", "book", "mentoring", "work", "other"] },

    "ContextSnapshotRef": {
      "type": "object",
      "properties": {
        "snapshot_id": { "type": "string" },
        "user_id": { "type": "string" },
        "ts": { "$ref": "#/$defs/IsoDate" },
        "signature_text": { "type": "string", "description": "Canonical context summary for embedding" },
        "embedding": { "type": "array", "items": { "type": "number" }, "minItems": 768 }, // OpenAI dims
        "hash": { "type": "string" },
        "size": { "type": "integer" },
        "approx_share": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "required": ["snapshot_id", "user_id", "ts", "signature_text", "embedding"]
    },

    "StoryBucket": {
      "type": "object",
      "properties": {
        "bucket_id": { "type": "string" },
        "owner_user_id": { "type": "string" },
        "from_snapshot_id": { "type": "string", "description": "CSR_A" },
        "to_snapshot_id": { "type": "string", "description": "CSR_B" },
        "created_at": { "$ref": "#/$defs/IsoDate" },
        "status": { "$ref": "#/$defs/StatusEnum" },
        "privacy": { "$ref": "#/$defs/PrivacyEnum" }
      },
      "required": ["bucket_id", "owner_user_id", "from_snapshot_id", "to_snapshot_id", "status", "privacy"]
    },

    "Story": {
      "type": "object",
      "properties": {
        "story_id": { "type": "string" },
        "owner_user_id": { "type": "string" },
        "created_at": { "$ref": "#/$defs/IsoDate" },
        "period": { "$ref": "#/$defs/Period" },
        "schedule": { "$ref": "#/$defs/Schedule" },
        "totals": {
          "type": "object",
          "properties": {
            "hours_total": { "type": "number", "minimum": 1, "maximum": 2000 },
            "cost_total": { "$ref": "#/$defs/Money" }
          },
          "required": ["hours_total", "cost_total"]
        },
        "basket": {
          "type": "object",
          "properties": {
            "skills": { "type": "array", "items": { "$ref": "#/$defs/SkillShare" }, "minItems": 1 }
          },
          "required": ["skills"]
        },
        "resources": { "type": "array", "items": { "$ref": "#/$defs/ResourceShare" }, "minItems": 0 },
        "feedback": {
          "type": "object",
          "properties": {
            "rating_1_5": { "type": "integer", "minimum": 1, "maximum": 5 },
            "recommend": { "type": "boolean" },
            "evidence": { "$ref": "#/$defs/Evidence" },
            "notes": { "type": "string" }
          },
          "required": ["rating_1_5", "recommend"]
        },
        "status": { "$ref": "#/$defs/StatusEnum" },
        "privacy": { "$ref": "#/$defs/PrivacyEnum" },
        "description_text": { "type": "string" }
      },
      "required": ["story_id", "owner_user_id", "period", "schedule", "totals", "basket", "feedback", "status", "privacy"],
      "allOf": [
        { "if": { "properties": { "totals": { "properties": { "cost_total": { "properties": { "currency": { "const": "EUR" } } } } } }, "then": { "properties": { "totals": { "properties": { "cost_total": { "properties": { "eur_at_ts": { "type": "null" } } } } } } },
        { "if": { "properties": { "totals": { "properties": { "cost_total": { "properties": { "currency": { "not": { "const": "EUR" } } } } } } }, "then": { "properties": { "totals": { "properties": { "cost_total": { "required": ["eur_at_ts"] } } } } },
        { "if": { "properties": { "feedback": { "properties": { "recommend": { "const": false }, "rating_1_5": { "minimum": 4 } } } } }, "then": { "description": "Warning: Inconsistency in feedback" } }
      ]
    },

    "CourseResource": {
      "type": "object",
      "properties": {
        "resource_id": { "type": "string" },
        "provider": { "type": "string" },
        "platform": { "type": "string" },
        "url_canonical": { "type": "string", "format": "uri" },
        "modality": { "$ref": "#/$defs/ModalityEnum" },
        "title": { "type": "string" },
        "locale": { "type": "string" }
      },
      "required": ["resource_id", "url_canonical", "modality"]
    },

    "Skill": {
      "type": "object",
      "properties": {
        "skill_id": { "type": "string" }, // ESCO ID
        "name": { "type": "string" },
        "aliases": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["skill_id", "name"]
    }
  }
}
```
