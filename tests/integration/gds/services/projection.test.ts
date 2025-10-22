/**
 * Unit tests for GdsProjectionService
 *
 * Tests projection lifecycle: create → reuse → drop
 *
 * NOTE: This test suite does NOT use shared setup.ts because it tests
 * projection lifecycle (create/drop operations). It loads test data
 * independently to avoid conflicts with other tests.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { GdsProjectionService } from '../../../../src/gds/services/gds-projection.service.js';
import { createDriver, withWriteSession } from '../../../../src/neo4j.js';
import { PersistenceManager } from '../../../../src/persistence-manager.js';
import { TestDataManager } from '../../../helpers/test-data-manager.js';
import type { Driver } from 'neo4j-driver';

describe('GdsProjectionService', () => {
  let service: GdsProjectionService;
  let driver: Driver;

  beforeAll(async () => {
    // Load test data once for projection tests
    driver = createDriver();
    const persistenceManager = new PersistenceManager(driver);
    const testDataManager = new TestDataManager();

    await withWriteSession(driver, async (tx) => {
      await tx.run('MATCH (n) DETACH DELETE n');
    });

    const userKeys = testDataManager.getAvailableKeys();
    for (const userKey of userKeys) {
      const story = testDataManager.getStoryBy(userKey);
      await persistenceManager.upsertStory(story);
    }

    console.log(`✅ [Projection Tests] Loaded ${userKeys.length} test users (U1-U7)`);
  }, 60000);

  beforeEach(async () => {
    service = new GdsProjectionService(driver);
  });

  afterEach(async () => {
    // Cleanup: drop all WayMates projections after each test
    const projections = await service.listProjections();
    for (const proj of projections.filter((p) =>
      p.graphName.startsWith('waymates-')
    )) {
      await service.dropProjection(proj.graphName);
    }
  });

  afterAll(async () => {
    await driver.close();
  }, 30000);

  describe('ensureSkillsGraphProjection', () => {
    it('should create skills graph projection', async () => {
      const info = await service.ensureSkillsGraphProjection();

      expect(info.graphName).toBe('waymates-skills-graph');
      expect(info.nodeCount).toBeGreaterThan(0);
      expect(info.relationshipCount).toBeGreaterThan(0);
      expect(info.createdAt).toBeInstanceOf(Date);

      // Should include Context, Skill, WorkDomain nodes
      // Even with small test data, we should have SOME relationships
      expect(info.nodeCount).toBeGreaterThan(10); // At least some test contexts
    });

    it('should reuse existing projection (idempotent)', async () => {
      // Create first time
      const info1 = await service.ensureSkillsGraphProjection();

      // Create second time (should reuse)
      const info2 = await service.ensureSkillsGraphProjection();

      // Should return same graph
      expect(info1.graphName).toBe(info2.graphName);
      expect(info1.nodeCount).toBe(info2.nodeCount);
      expect(info1.relationshipCount).toBe(info2.relationshipCount);

      // Should NOT create duplicate
      const allProjections = await service.listProjections();
      const skillsProjections = allProjections.filter((p) =>
        p.graphName === 'waymates-skills-graph'
      );
      expect(skillsProjections).toHaveLength(1);
    });
  });

  describe('ensureTemporalGraphProjection', () => {
    it('should create temporal graph projection', async () => {
      const info = await service.ensureTemporalGraphProjection();

      expect(info.graphName).toBe('waymates-temporal-graph');
      expect(info.nodeCount).toBeGreaterThan(0);
      expect(info.createdAt).toBeInstanceOf(Date);

      // Temporal graph should have Context nodes
      // Relationship count might be 0 in empty test DB (no [:NEXT] yet)
      expect(info.relationshipCount).toBeGreaterThanOrEqual(0);
    });

    it('should reuse existing projection (idempotent)', async () => {
      const info1 = await service.ensureTemporalGraphProjection();
      const info2 = await service.ensureTemporalGraphProjection();

      expect(info1.graphName).toBe(info2.graphName);
      expect(info1.nodeCount).toBe(info2.nodeCount);
    });
  });

  describe('projectionExists', () => {
    it('should return false for non-existent projection', async () => {
      const exists = await service.projectionExists('non-existent-graph');
      expect(exists).toBe(false);
    });

    it('should return true for existing projection', async () => {
      await service.ensureSkillsGraphProjection();
      const exists = await service.projectionExists('waymates-skills-graph');
      expect(exists).toBe(true);
    });
  });

  describe('dropProjection', () => {
    it('should drop existing projection', async () => {
      // Create projection
      await service.ensureSkillsGraphProjection();

      // Verify it exists
      let exists = await service.projectionExists('waymates-skills-graph');
      expect(exists).toBe(true);

      // Drop it
      await service.dropProjection('waymates-skills-graph');

      // Verify it's gone
      exists = await service.projectionExists('waymates-skills-graph');
      expect(exists).toBe(false);
    });

    it('should handle dropping non-existent projection gracefully', async () => {
      // Should not throw error
      await expect(
        service.dropProjection('non-existent-graph')
      ).resolves.toBeUndefined();
    });
  });

  describe('listProjections', () => {
    it('should return empty list when no projections exist', async () => {
      // Cleanup first
      await service.dropAllProjections();

      const projections = await service.listProjections();
      expect(projections).toEqual([]);
    });

    it('should list all existing projections', async () => {
      // Create multiple projections
      await service.ensureSkillsGraphProjection();
      await service.ensureTemporalGraphProjection();

      const projections = await service.listProjections();

      expect(projections).toHaveLength(2);
      expect(projections.map((p) => p.graphName)).toContain(
        'waymates-skills-graph'
      );
      expect(projections.map((p) => p.graphName)).toContain(
        'waymates-temporal-graph'
      );

      // Each projection should have stats
      projections.forEach((proj) => {
        expect(proj.nodeCount).toBeGreaterThanOrEqual(0);
        expect(proj.relationshipCount).toBeGreaterThanOrEqual(0);
        expect(proj.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('getProjectionInfo', () => {
    it('should return projection info for existing graph', async () => {
      await service.ensureSkillsGraphProjection();

      const info = await service.getProjectionInfo('waymates-skills-graph');

      expect(info.graphName).toBe('waymates-skills-graph');
      expect(info.nodeCount).toBeGreaterThan(0);
      expect(info.relationshipCount).toBeGreaterThan(0);
    });

    it('should throw error for non-existent projection', async () => {
      await expect(
        service.getProjectionInfo('non-existent-graph')
      ).rejects.toThrow("Projection 'non-existent-graph' not found");
    });
  });

  describe('dropAllProjections', () => {
    it('should drop all projections', async () => {
      // Create multiple projections
      await service.ensureSkillsGraphProjection();
      await service.ensureTemporalGraphProjection();

      // Verify they exist
      let projections = await service.listProjections();
      expect(projections.length).toBeGreaterThanOrEqual(2);

      // Drop all
      await service.dropAllProjections();

      // Verify all gone
      projections = await service.listProjections();
      expect(projections).toEqual([]);
    });
  });
});
