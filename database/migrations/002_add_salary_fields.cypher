// Neo4j migration: Add salary fields to Context nodes
// Created: 2025-11-15
// Purpose: Add salaryExact, salaryMin, salaryMax fields to existing Context nodes
// Feature: #1 - Salary range support

// Set salary fields to null for existing Context nodes that don't have them
MATCH (c:Context)
WHERE c.salaryExact IS NULL AND c.salaryMin IS NULL AND c.salaryMax IS NULL
SET c.salaryExact = null,
    c.salaryMin = null,
    c.salaryMax = null
RETURN count(c) AS migratedContexts;
