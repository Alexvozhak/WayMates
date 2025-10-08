# 💻 Level 4: Код данных WayMates (ОБНОВЛЕНО)

## 📊 Детальная реализация типов данных

### **Базовые типы данных**

```typescript
// ===== БАЗОВЫЕ ТИПЫ =====

// Общие интерфейсы
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TimestampedEntity extends BaseEntity {
  createdBy: string;
  updatedBy: string;
}

// Метаданные
interface Metadata {
  [key: string]: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ===== ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ =====

interface UserProfile extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  bio?: string;
  skills: Skill[];
  experience: UserExperience;
  location: UserLocation;
  preferences: UserPreferences;
  stats: UserStats;
  isActive: boolean;
  roles: UserRole[];
  // НОВОЕ: Skill Saturation Metrics
  skillSaturation: SkillSaturationMetrics;
  // НОВОЕ: Vertical Growth Readiness
  verticalReadiness: VerticalReadinessMetrics;
}

interface SkillSaturationMetrics {
  horizontalSkillCount: number;
  marketUtilizationRate: number;
  salaryProgressionRate: number;
  roleStagnationMonths: number;
  saturationDetected: boolean;
  recommendation: 'keep_learning' | 'plateau_detected' | 'ready_for_vertical';
  analysisDate: Date;
}

interface VerticalReadinessMetrics {
  technicalCredibility: number;
  provenResponsibility: number;
  leadershipMotivation: number;
  opportunityAvailability: number;
  overallReadiness: number;
  blockers: string[];
  actionPlan: VerticalGrowthAction[];
}

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  yearsOfExperience: number;
  verified: boolean;
  verifiedAt?: Date;
  // НОВОЕ: ESCO Integration
  escoId?: string;
  tier: number; // 0=ЯП, 1=Технология, 2=Библиотека
  ectsBaselineHours?: number;
}

interface UserExperience {
  years: number;
  level: ExperienceLevel;
  domains: string[];
  currentRole?: string;
  currentCompany?: string;
  previousRoles: PreviousRole[];
  // НОВОЕ: Career Axis Analysis
  careerAxis: {
    width: number;        // Рост по ширине (%)
    depth: number;        // Рост по глубине (грейд)
    vertical: number;     // Рост по вертикали (команда)
    recommendedAxis: 'width' | 'depth' | 'vertical' | 'choice';
  };
}

interface UserLocation {
  current: LocationInfo;
  target: LocationInfo[];
  willingToRelocate: boolean;
  visaStatus?: VisaStatus;
}

interface UserPreferences {
  language: string;
  currency: string;
  timezone: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  search: SearchPreferences;
}

interface UserStats {
  storiesCreated: number;
  routesFollowed: number;
  successRate: number;
  communityRating: number;
  lastActiveAt: Date;
  // НОВОЕ: Career Intelligence Metrics
  skillSaturationScore: number;
  verticalReadinessScore: number;
  careerProgressionRate: number;
}

// ===== КОНТЕНТНЫЕ ДАННЫЕ =====

interface Story extends TimestampedEntity {
  authorId: string;
  title: string;
  content: string;
  processedContent: string;
  summary: string;
  metadata: StoryMetadata;
  steps: StoryStep[];
  files: StoryFile[];
  tags: string[];
  status: StoryStatus;
  visibility: VisibilityLevel;
  moderation: ModerationInfo;
  engagement: EngagementMetrics;
}

interface Avatar extends BaseEntity {
  userId: string;
  startingContext: UserContext;
  intermediateSteps: RoleTransition[];
  finalRole: string;
  timeSpent: number;
  satisfactionScore: number;
  axisProgression: {
    width: number;
    depth: number;
    vertical: number;
  };
  careerPath: CareerPath;
}

interface RoleTransition {
  fromRole: string;
  toRole: string;
  monthsDuration: number;
  keySkillsLearned: string[];
  axis: 'width' | 'depth' | 'vertical';
  contextAtTransition: UserContext;
  success: boolean;
  satisfaction: number;
}

interface CareerPath {
  id: string;
  title: string;
  description: string;
  steps: CareerPathStep[];
  statistics: CareerPathStatistics;
  successRate: number;
  averageTimeline: number;
}

interface CareerPathStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  requiredSkills: string[];
  optionalSkills: string[];
  timeline: string;
  successRate: number;
  commonObstacles: string[];
  resources: Resource[];
}

interface Route extends TimestampedEntity {
  title: string;
  description: string;
  summary: string;
  targetRole: string;
  targetCountry: string;
  experienceLevel: ExperienceLevel;
  steps: RouteStep[];
  statistics: RouteStatistics;
  tags: string[];
  status: RouteStatus;
  visibility: VisibilityLevel;
  quality: QualityMetrics;
}

interface RouteStep extends BaseEntity {
  routeId: string;
  stepNumber: number;
  title: string;
  description: string;
  averageTimeline: string;
  successRate: number;
  commonObstacles: string[];
  requiredSkills: Skill[];
  optionalSkills: Skill[];
  resources: Resource[];
  tips: string[];
  warnings: string[];
}

// ===== CAREER INTELLIGENCE ДАННЫЕ =====

interface SkillSaturationAnalysis extends BaseEntity {
  userId: string;
  horizontalSkillCount: number;
  marketUtilizationRate: number;
  salaryProgressionRate: number;
  roleStagnationMonths: number;
  saturationDetected: boolean;
  recommendation: 'keep_learning' | 'plateau_detected' | 'ready_for_vertical';
  analysisDate: Date;
}

interface VerticalGrowthAttempt extends BaseEntity {
  userId: string;
  fromRole: string;
  toRole: string;
  monthsInRole: number;
  technicalCredibilityScore: number;
  provenResponsibilityScore: number;
  leadershipMotivationScore: number;
  companyOpportunityScore: number;
  attemptSuccessful: boolean;
  attemptDate: Date;
  // НОВОЕ: Proven Responsibility Details
  responsibilityDetails: ResponsibilityEvaluation;
}

interface ResponsibilityEvaluation {
  role: string;
  durationMonths: number;
  endReason: 'promoted' | 'lateral_move' | 'demoted' | 'voluntary_return';
  results: {
    projectsDelivered: number;
    budgetPerformance: 'under' | 'on_time' | 'over';
    teamSatisfactionScore: number;
    stakeholderFeedback: 'positive' | 'neutral' | 'negative';
  };
  recognition: {
    formalAwards: boolean;
    mentorshipRequests: number;
    managementOffers: number;
  };
  personalFit: {
    enjoymentLevel: number;
    stressLevel: number;
    futureMotivation: 'eager' | 'willing' | 'reluctant';
  };
  overallScore: number;
  readiness: 'not_ready' | 'needs_development' | 'ready' | 'highly_ready';
}

interface CompanyTypeAnalysis extends BaseEntity {
  companyStage: string;
  companySizeCategory: string;
  industrySector: string;
  promotionRate: number;
  averageTimeline: number;
  predictability: 'high' | 'medium' | 'low';
  financialImpact: number;
  sampleSize: number;
  analysisDate: Date;
}

interface PromotionPattern extends BaseEntity {
  fromRole: string;
  toRole: string;
  companyType: string;
  successRate: number;
  averageTime: number;
  requiredSkills: string[];
  commonObstacles: string[];
  sampleSize: number;
}

// ===== ПОИСКОВЫЕ ДАННЫЕ =====

interface SearchQuery extends BaseEntity {
  userId: string;
  text: string;
  embedding: number[];
  filters: SearchFilters;
  results: SearchResult[];
  totalCount: number;
  processingTime: number;
  cached: boolean;
}

interface SearchResult {
  id: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  summary: string;
  similarity: number;
  confidence: number;
  matchedSteps?: string[];
  explanation: string;
  metadata: SearchResultMetadata;
}

interface Embedding extends BaseEntity {
  contentId: string;
  contentType: ContentType;
  embedding: number[];
  model: string;
  version: string;
  dimensions: number;
  normalized: boolean;
}

interface SimilarityMetric extends BaseEntity {
  sourceId: string;
  targetId: string;
  similarity: number;
  method: SimilarityMethod;
  confidence: number;
  metadata: SimilarityMetadata;
}

// ===== AI PROCESSING ДАННЫЕ =====

interface LightRAGQuery extends BaseEntity {
  query: string;
  userContext: UserContext;
  response: {
    skills: Skill[];
    explanation: string;
    recommendedPath: LearningPath;
  };
  processingTime: number;
}

interface CareerAnalysis extends BaseEntity {
  skillDependencies: SkillDependency[];
  companyTypeRecommendations: CompanyTypeAnalysis[];
  verticalGrowthProbability: number;
  timePredictions: TimePrediction[];
  riskFactors: string[];
  actionPlan: CareerAction[];
}

interface SkillDependency extends BaseEntity {
  skillId: string;
  prerequisiteSkill: string;
  impact: {
    successRateWith: number;
    successRateWithout: number;
    timeImpact: string;
    sampleSize: number;
  };
  recommendation: 'critical' | 'optional';
  confidence: number;
}

interface TimePrediction extends BaseEntity {
  skillId: string;
  weeksNormal: number;
  weeksSafe: number;
  confidence: number;
  explanation: string;
  method: 'statistical' | 'esco_baseline' | 'expert_estimate';
}

// ===== КЭШИРОВАНИЕ =====

interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

interface UserSession {
  sessionId: string;
  userId: string;
  data: SessionData;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt: Date;
}

interface QueryCache {
  queryHash: string;
  results: SearchResult[];
  filters: SearchFilters;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}

// ===== МЕТАДАННЫЕ =====

interface SystemConfig extends BaseEntity {
  key: string;
  value: any;
  type: ConfigType;
  description: string;
  category: string;
  isSecret: boolean;
  updatedBy: string;
}

interface AuditLog extends BaseEntity {
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

interface DataQuality extends BaseEntity {
  resourceType: string;
  resourceId: string;
  metrics: QualityMetrics;
  score: number;
  checkedAt: Date;
  checkedBy: string;
  issues: QualityIssue[];
}

// ===== ENUMS И ТИПЫ =====

enum SkillCategory {
  PROGRAMMING = 'programming',
  DESIGN = 'design',
  MANAGEMENT = 'management',
  LANGUAGE = 'language',
  SOFT_SKILLS = 'soft_skills',
  DOMAIN_KNOWLEDGE = 'domain_knowledge'
}

enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

enum ExperienceLevel {
  JUNIOR = 'junior',
  MIDDLE = 'middle',
  SENIOR = 'senior',
  LEAD = 'lead',
  ARCHITECT = 'architect',
  MANAGER = 'manager'
}

enum StepType {
  SKILL_DEVELOPMENT = 'skill_development',
  JOB_SEARCH = 'job_search',
  RELOCATION = 'relocation',
  BUREAUCRACY = 'bureaucracy',
  NETWORKING = 'networking',
  EDUCATION = 'education',
  PROJECT = 'project'
}

enum StoryStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  REJECTED = 'rejected'
}

enum RouteStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived'
}

enum VisibilityLevel {
  PRIVATE = 'private',
  FRIENDS = 'friends',
  COMMUNITY = 'community',
  PUBLIC = 'public'
}

enum ContentType {
  STORY = 'story',
  ROUTE = 'route',
  STEP = 'step',
  USER = 'user',
  AVATAR = 'avatar'
}

enum SimilarityMethod {
  COSINE = 'cosine',
  EUCLIDEAN = 'euclidean',
  MANHATTAN = 'manhattan',
  DOT_PRODUCT = 'dot_product'
}

enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array'
}

enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  SEARCH = 'search',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

// ===== СЛОЖНЫЕ ТИПЫ =====

interface LocationInfo {
  country: string;
  countryCode: string;
  city: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  timezone: string;
  currency: string;
  language: string;
}

interface VisaStatus {
  type: string;
  status: string;
  expiresAt?: Date;
  requirements: string[];
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  types: string[];
}

interface PrivacySettings {
  profileVisibility: VisibilityLevel;
  storyVisibility: VisibilityLevel;
  searchVisibility: boolean;
  dataSharing: boolean;
  analytics: boolean;
}

interface SearchPreferences {
  defaultFilters: SearchFilters;
  maxResults: number;
  sortBy: string;
  language: string;
  includeArchived: boolean;
}

interface PreviousRole {
  title: string;
  company: string;
  duration: string;
  description: string;
  skills: string[];
}

interface StoryMetadata {
  skills: string[];
  fromLocation: LocationInfo;
  toLocation: LocationInfo;
  timeline: TimelineInfo;
  budget: BudgetInfo;
  success: boolean;
  difficulty: number;
  rating: number;
  verified: boolean;
}

interface TimelineInfo {
  duration: string;
  startDate?: Date;
  endDate?: Date;
  phases: TimelinePhase[];
}

interface TimelinePhase {
  name: string;
  duration: string;
  description: string;
  order: number;
}

interface BudgetInfo {
  total: number;
  currency: string;
  breakdown: BudgetBreakdown[];
}

interface BudgetBreakdown {
  category: string;
  amount: number;
  percentage: number;
  description: string;
}

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  url?: string;
  description: string;
  cost: number;
  currency: string;
  rating: number;
  verified: boolean;
}

interface StoryFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

interface ModerationInfo {
  status: ModerationStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  comments: string[];
  flags: ModerationFlag[];
  score: number;
}

interface EngagementMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  bookmarks: number;
  rating: number;
  lastEngagement: Date;
}

interface RouteStatistics {
  totalStories: number;
  successRate: number;
  averageTimeline: string;
  averageBudget: number;
  commonChallenges: string[];
  topSkills: Skill[];
  topResources: Resource[];
  lastUpdated: Date;
}

interface QualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  relevance: number;
  overall: number;
}

interface SearchFilters {
  skills?: string[];
  locations?: string[];
  timeline?: number;
  experience?: ExperienceLevel;
  budget?: BudgetRange;
  success?: boolean;
  verified?: boolean;
  dateRange?: DateRange;
  tags?: string[];
}

interface SearchResultMetadata {
  matchedFields: string[];
  highlightSnippets: string[];
  relatedContent: string[];
  confidence: number;
  explanation: string;
}

interface SimilarityMetadata {
  algorithm: string;
  parameters: any;
  processingTime: number;
  normalized: boolean;
}

interface SessionData {
  currentQuery?: string;
  searchHistory: string[];
  preferences: any;
  lastRoute?: string;
  bookmarks: string[];
}

interface QualityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  field?: string;
}

// ===== ДОПОЛНИТЕЛЬНЫЕ ТИПЫ =====

enum ResourceType {
  COURSE = 'course',
  BOOK = 'book',
  ARTICLE = 'article',
  VIDEO = 'video',
  TOOL = 'tool',
  SERVICE = 'service',
  COMMUNITY = 'community'
}

enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  UNDER_REVIEW = 'under_review'
}

enum ModerationFlag {
  INAPPROPRIATE = 'inappropriate',
  SPAM = 'spam',
  MISLEADING = 'misleading',
  COPYRIGHT = 'copyright',
  PRIVACY = 'privacy',
  QUALITY = 'quality'
}

enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  EDITOR = 'editor',
  ADMIN = 'admin'
}

interface BudgetRange {
  min: number;
  max: number;
  currency: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

// ===== DTO ТИПЫ =====

interface CreateUserProfileDto {
  firstName: string;
  lastName: string;
  email: string;
  skills: string[];
  experience: Partial<UserExperience>;
  location: Partial<UserLocation>;
  preferences?: Partial<UserPreferences>;
}

interface UpdateUserProfileDto {
  firstName?: string;
  lastName?: string;
  skills?: string[];
  experience?: Partial<UserExperience>;
  location?: Partial<UserLocation>;
  preferences?: Partial<UserPreferences>;
}

interface CreateStoryDto {
  authorId: string;
  title: string;
  content: string;
  metadata?: Partial<StoryMetadata>;
  tags?: string[];
  visibility?: VisibilityLevel;
}

interface UpdateStoryDto {
  title?: string;
  content?: string;
  metadata?: Partial<StoryMetadata>;
  tags?: string[];
  visibility?: VisibilityLevel;
}

interface CreateAvatarDto {
  userId: string;
  startingContext: UserContext;
  intermediateSteps: RoleTransition[];
  finalRole: string;
  timeSpent: number;
  satisfactionScore: number;
}

interface CreateRouteDto {
  title: string;
  description: string;
  targetRole: string;
  targetCountry: string;
  experienceLevel: ExperienceLevel;
  steps: Partial<RouteStep>[];
  tags?: string[];
}

interface SearchQueryDto {
  text: string;
  filters?: SearchFilters;
  userId?: string;
}

// ===== RESPONSE ТИПЫ =====

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
  requestId: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
  processingTime: number;
  filters: SearchFilters;
  suggestions: string[];
  relatedQueries: string[];
}

// ===== ВАЛИДАЦИЯ =====

interface ValidationRule {
  field: string;
  type: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
  message: string;
}

interface SchemaDefinition {
  name: string;
  version: string;
  fields: Record<string, FieldDefinition>;
  rules: ValidationRule[];
  indexes: IndexDefinition[];
}

interface FieldDefinition {
  type: string;
  required: boolean;
  nullable: boolean;
  unique: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
}

interface IndexDefinition {
  fields: string[];
  type: 'unique' | 'index' | 'fulltext' | 'vector';
  options?: any;
}
```

## 🏗️ Схемы базы данных

### **PostgreSQL Schema**
```sql
-- Пользователи с skill saturation metrics
CREATE TABLE users (
  id UUID PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  skills TEXT[],
  experience JSONB,
  location JSONB,
  preferences JSONB,
  skill_saturation JSONB,
  vertical_readiness JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ESCO Skills с иерархией
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  esco_id VARCHAR UNIQUE NOT NULL,
  name_en VARCHAR NOT NULL,
  name_ru VARCHAR,
  skill_type skill_type_enum NOT NULL,
  tier INT NOT NULL CHECK (tier IN (0,1,2)),
  ects_baseline_hours INT,
  alt_labels TEXT[],
  embedding VECTOR(1024),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Истории с аватарами
CREATE TABLE stories (
  id UUID PRIMARY KEY,
  author_id UUID REFERENCES users(id),
  title VARCHAR(255),
  content TEXT,
  processed_content TEXT,
  metadata JSONB,
  steps JSONB,
  status story_status_enum DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Аватары для career path analysis
CREATE TABLE avatars (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  starting_context JSONB,
  intermediate_steps JSONB,
  final_role VARCHAR(100),
  time_spent INT,
  satisfaction_score INT,
  axis_progression JSONB,
  career_path JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Apache AGE Graph для связей
SELECT create_graph('waymates_graph');

-- Nodes: (:Skill), (:User), (:Goal), (:LearningPath), (:Avatar)
-- Relationships: 
-- (:Skill)-[:BROADER_THAN]->(:Skill) -- ESCO hierarchy
-- (:Skill)-[:PREREQUISITE_FOR]->(:Skill) -- learning dependencies  
-- (:User)-[:LEARNED]->(:Skill) -- completion facts
-- (:User)-[:TARGETING]->(:Goal) -- current objectives
-- (:Avatar)-[:SIMILAR_TO]->(:Avatar) -- career path similarity
```

### **ClickHouse Schema**
```sql
-- Skill saturation analysis
CREATE TABLE skill_saturation_analysis (
  user_id UUID,
  skills_count UInt16,
  market_utilization_rate Float32,
  salary_stagnation_months UInt16,
  saturation_detected Boolean,
  analysis_date Date
) ENGINE = MergeTree()
ORDER BY (analysis_date, saturation_detected);

-- Vertical growth attempts
CREATE TABLE vertical_growth_attempts (
  user_id UUID,
  from_role String,
  to_role String,
  months_in_role UInt16,
  technical_credibility_score UInt8,
  proven_responsibility_score UInt8,
  leadership_motivation_score UInt8,
  company_opportunity_score UInt8,
  attempt_successful Boolean,
  responsibility_details JSONB,
  attempt_date Date
) ENGINE = MergeTree()
ORDER BY (from_role, to_role, attempt_date);

-- Company type analysis
CREATE TABLE company_type_analysis (
  company_stage String,
  company_size_category String,
  industry_sector String,
  promotion_rate Float32,
  average_timeline Float32,
  predictability String,
  financial_impact Float32,
  sample_size UInt32,
  analysis_date Date
) ENGINE = MergeTree()
ORDER BY (company_stage, company_size_category, analysis_date);

-- Career transitions tracking
CREATE TABLE career_transitions (
  user_id UUID,
  from_role String,
  to_role String,
  company_type String,
  company_size String,
  months_to_promotion UInt16,
  promotion_successful Boolean,
  salary_increase_percent Float32,
  required_skills_match Float32,
  transition_date Date
) ENGINE = MergeTree()
ORDER BY (from_role, to_role, transition_date);

-- Skill learning journeys
CREATE TABLE skill_learning_journeys (
  user_id UUID,
  target_skill_id String,
  prerequisite_skill_id String,
  had_prerequisite Boolean,
  learning_time_weeks UInt16,
  successful Boolean,
  tempo_type String,
  paradigm_bonus_applied Boolean,
  completion_date Date
) ENGINE = MergeTree()
ORDER BY (target_skill_id, completion_date);
```

### **Redis Schema**
```json
{
  "user_sessions": {
    "session_id": {
      "userId": "string",
      "data": "object",
      "createdAt": "datetime",
      "lastAccessed": "datetime",
      "expiresAt": "datetime"
    }
  },
  "query_cache": {
    "query_hash": {
      "results": "array",
      "filters": "object",
      "createdAt": "datetime",
      "expiresAt": "datetime",
      "hitCount": "int"
    }
  },
  "career_intelligence_cache": {
    "user_id": {
      "skillSaturation": "object",
      "verticalReadiness": "object",
      "cachedAt": "datetime",
      "expiresAt": "datetime"
    }
  },
  "avatar_similarity_cache": {
    "user_context_hash": {
      "similarAvatars": "array",
      "cachedAt": "datetime",
      "expiresAt": "datetime"
    }
  }
}
```

## 🎯 Ключевые алгоритмы

### **Skill Saturation Detection Algorithm**
```typescript
class SkillSaturationDetector {
  async detectSaturation(userProfile: UserProfile): Promise<SkillSaturationAnalysis> {
    const marketDemand = await this.getMarketSkillDemand(userProfile.skills);
    const salaryStagnation = userProfile.salaryGrowth < 15; // за 18 месяцев
    const roleTime = userProfile.monthsInCurrentRole > 24;
    
    const saturationDetected = (
      marketDemand.utilizationRate < 30 && 
      salaryStagnation && 
      roleTime
    );
    
    return {
      horizontalSkillCount: userProfile.skills.length,
      marketUtilizationRate: marketDemand.utilizationRate,
      salaryProgressionRate: userProfile.salaryGrowth,
      roleStagnationMonths: userProfile.monthsInCurrentRole,
      saturationDetected,
      recommendation: saturationDetected ? 'ready_for_vertical' : 'keep_learning'
    };
  }
}
```

### **Vertical Readiness Assessment Algorithm**
```typescript
class VerticalReadinessAssessor {
  async assessReadiness(userProfile: UserProfile): Promise<VerticalReadinessScore> {
    const technicalCredibility = await this.assessTechnicalCredibility(userProfile);
    const provenResponsibility = await this.assessProvenResponsibility(userProfile);
    const leadershipMotivation = await this.assessLeadershipMotivation(userProfile);
    const opportunityAvailability = await this.assessOpportunityAvailability(userProfile);
    
    const overallReadiness = (
      technicalCredibility * 0.3 +
      provenResponsibility * 0.3 +
      leadershipMotivation * 0.2 +
      opportunityAvailability * 0.2
    );
    
    return {
      technicalCredibility,
      provenResponsibility,
      leadershipMotivation,
      opportunityAvailability,
      overallReadiness,
      blockers: this.identifyBlockers(overallReadiness),
      actionPlan: this.createActionPlan(overallReadiness)
    };
  }
}
```

### **Career Path Recommendation Algorithm**
```typescript
class CareerPathRecommender {
  async recommendPath(userProfile: UserProfile): Promise<CareerPathRecommendation> {
    const skillSaturation = await this.analyzeSkillSaturation(userProfile);
    const verticalReadiness = await this.assessVerticalReadiness(userProfile);
    
    if (skillSaturation.saturationDetected && verticalReadiness.overallReadiness > 70) {
      return {
        recommendedPath: 'vertical_growth',
        targetRoles: await this.findTargetRoles(userProfile),
        companyTypes: await this.recommendCompanyTypes(userProfile),
        timeline: await this.estimateTimeline(userProfile, 'vertical_growth'),
        actionPlan: verticalReadiness.actionPlan
      };
    } else if (skillSaturation.saturationDetected) {
      return {
        recommendedPath: 'skill_development',
        targetSkills: await this.recommendSkills(userProfile),
        timeline: await this.estimateTimeline(userProfile, 'skill_development'),
        actionPlan: await this.createSkillDevelopmentPlan(userProfile)
      };
    } else {
      return {
        recommendedPath: 'horizontal_growth',
        targetSkills: await this.recommendSkills(userProfile),
        timeline: await this.estimateTimeline(userProfile, 'horizontal_growth'),
        actionPlan: await this.createHorizontalGrowthPlan(userProfile)
      };
    }
  }
}
```