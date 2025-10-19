// Neo4j initialization script for WayMates

// Constraints
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE;
CREATE CONSTRAINT context_id_unique IF NOT EXISTS FOR (c:Context) REQUIRE c.context_id IS UNIQUE;
CREATE CONSTRAINT position_name_unique IF NOT EXISTS FOR (p:Position) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT industry_name_unique IF NOT EXISTS FOR (i:Industry) REQUIRE i.name IS UNIQUE;
CREATE CONSTRAINT work_domain_name_unique IF NOT EXISTS FOR (wd:WorkDomain) REQUIRE wd.name IS UNIQUE;
CREATE CONSTRAINT skill_name_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT skill_category_id_unique IF NOT EXISTS FOR (sc:SkillCategory) REQUIRE sc.category_id IS UNIQUE;
CREATE CONSTRAINT country_code_unique IF NOT EXISTS FOR (ct:Country) REQUIRE ct.code IS UNIQUE;
CREATE CONSTRAINT city_identity_unique IF NOT EXISTS FOR (ci:City) REQUIRE (ci.name, ci.code) IS UNIQUE;
CREATE CONSTRAINT trail_id_unique IF NOT EXISTS FOR (t:Trail) REQUIRE t.trail_id IS UNIQUE;
CREATE CONSTRAINT platform_name_unique IF NOT EXISTS FOR (p:Platform) REQUIRE p.name IS UNIQUE;

// Indexes for filters
CREATE INDEX skill_name IF NOT EXISTS FOR (s:Skill) ON (s.name);
CREATE INDEX skill_platform_composite IF NOT EXISTS FOR (spn:SkillPlatformNode) ON (spn.skill, spn.platform);

// Context field indexes for fast search
CREATE INDEX context_position IF NOT EXISTS FOR (c:Context) ON (c.position);
CREATE INDEX context_industry IF NOT EXISTS FOR (c:Context) ON (c.industry);
CREATE INDEX context_city IF NOT EXISTS FOR (c:Context) ON (c.city_name);
CREATE INDEX context_country IF NOT EXISTS FOR (c:Context) ON (c.country_code);
CREATE INDEX context_work_type IF NOT EXISTS FOR (c:Context) ON (c.work_type);
CREATE INDEX context_company_size IF NOT EXISTS FOR (c:Context) ON (c.company_size);
CREATE INDEX context_team_size IF NOT EXISTS FOR (c:Context) ON (c.team_size);
CREATE INDEX context_domains IF NOT EXISTS FOR (c:Context) ON (c.domains);
CREATE INDEX context_skills IF NOT EXISTS FOR (c:Context) ON (c.skills);
CREATE INDEX context_citizenships IF NOT EXISTS FOR (c:Context) ON (c.citizenships);

// Temporal navigation indexes
CREATE INDEX context_previous IF NOT EXISTS FOR (c:Context) ON (c.previous_context_id);
CREATE INDEX context_next IF NOT EXISTS FOR (c:Context) ON (c.next_context_id);
CREATE INDEX context_created_at IF NOT EXISTS FOR (c:Context) ON (c.created_at);

// Indexes for trail path queries (performance optimization)
CREATE INDEX trail_from_context IF NOT EXISTS FOR ()-[r:STEPS_ON]-() ON (r.from_context_id);
CREATE INDEX trail_to_context IF NOT EXISTS FOR ()-[r:STEPS_TO]-() ON (r.to_context_id);
CREATE INDEX trail_platform IF NOT EXISTS FOR (t:Trail) ON (t.platform);
