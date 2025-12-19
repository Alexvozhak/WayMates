// Neo4j initialization script for WayMates

// Constraints
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE;
CREATE CONSTRAINT context_id_unique IF NOT EXISTS FOR (c:Context) REQUIRE c.contextId IS UNIQUE;
CREATE CONSTRAINT country_name_unique IF NOT EXISTS FOR (ct:Country) REQUIRE ct.name IS UNIQUE;
CREATE CONSTRAINT trail_id_unique IF NOT EXISTS FOR (t:Trail) REQUIRE t.trailId IS UNIQUE;
CREATE CONSTRAINT reason_canonical_name_unique IF NOT EXISTS FOR (r:Reason) REQUIRE r.canonicalName IS UNIQUE;
CREATE CONSTRAINT goal_user_id_unique IF NOT EXISTS FOR (g:Goal) REQUIRE g.userId IS UNIQUE;

// Dictionary constraints (canonicalName for normalization)
CREATE CONSTRAINT role_canonical_name_unique IF NOT EXISTS FOR (r:Role) REQUIRE r.canonicalName IS UNIQUE;
CREATE CONSTRAINT position_canonical_name_unique IF NOT EXISTS FOR (p:Position) REQUIRE p.canonicalName IS UNIQUE;
CREATE CONSTRAINT industry_canonical_name_unique IF NOT EXISTS FOR (i:Industry) REQUIRE i.canonicalName IS UNIQUE;
CREATE CONSTRAINT work_domain_canonical_name_unique IF NOT EXISTS FOR (wd:WorkDomain) REQUIRE wd.canonicalName IS UNIQUE;
CREATE CONSTRAINT skill_canonical_name_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.canonicalName IS UNIQUE;
CREATE CONSTRAINT city_canonical_name_unique IF NOT EXISTS FOR (ci:City) REQUIRE ci.canonicalName IS UNIQUE;
CREATE CONSTRAINT platform_canonical_name_unique IF NOT EXISTS FOR (p:Platform) REQUIRE p.canonicalName IS UNIQUE;
CREATE CONSTRAINT language_code_unique IF NOT EXISTS FOR (l:Language) REQUIRE l.code IS UNIQUE;

// Indexes for filters
CREATE INDEX skill_platform_composite IF NOT EXISTS FOR (spn:SkillPlatformNode) ON (spn.skill, spn.platform);

// Context field indexes for fast search
CREATE INDEX context_position IF NOT EXISTS FOR (c:Context) ON (c.position);
CREATE INDEX context_industry IF NOT EXISTS FOR (c:Context) ON (c.industry);
CREATE INDEX context_city IF NOT EXISTS FOR (c:Context) ON (c.cityName);
CREATE INDEX context_country IF NOT EXISTS FOR (c:Context) ON (c.countryCode);
CREATE INDEX context_company_size IF NOT EXISTS FOR (c:Context) ON (c.companySize);
CREATE INDEX context_domains IF NOT EXISTS FOR (c:Context) ON (c.domains);
CREATE INDEX context_skills IF NOT EXISTS FOR (c:Context) ON (c.skills);
CREATE INDEX context_citizenships IF NOT EXISTS FOR (c:Context) ON (c.citizenships);
CREATE INDEX context_creation_reason IF NOT EXISTS FOR (c:Context) ON (c.creationReason);
CREATE INDEX context_education_level IF NOT EXISTS FOR (c:Context) ON (c.educationLevel);

// Temporal navigation indexes
CREATE INDEX context_previous IF NOT EXISTS FOR (c:Context) ON (c.previousContextId);
CREATE INDEX context_next IF NOT EXISTS FOR (c:Context) ON (c.nextContextId);
CREATE INDEX context_created_at IF NOT EXISTS FOR (c:Context) ON (c.createdAt);

// Indexes for trail path queries (performance optimization)
CREATE INDEX trail_from_context IF NOT EXISTS FOR ()-[r:STEPS_ON]-() ON (r.fromContextId);
CREATE INDEX trail_to_context IF NOT EXISTS FOR ()-[r:STEPS_TO]-() ON (r.toContextId);
CREATE INDEX trail_platform IF NOT EXISTS FOR (t:Trail) ON (t.platform);
