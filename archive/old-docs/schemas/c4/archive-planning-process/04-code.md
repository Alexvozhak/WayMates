# 💻 Level 4: Code Level

## 📊 NestJS Module Architecture

```mermaid
C4Component
    title Code Level - NestJS Modules & Dependencies

    Container_Boundary(app, "WayMates Core API") {
        Component(app_module, "App Module", "@Module", "Корневой модуль приложения")
        
        Component(stories_module, "Stories Module", "@Module", "Модуль управления историями")
        Component(queries_module, "Queries Module", "@Module", "Модуль обработки запросов")
        Component(moderation_module, "Moderation Module", "@Module", "Модуль модерации")
        Component(auth_module, "Auth Module", "@Module", "Модуль аутентификации")
        
        Component(integrations_module, "Integrations Module", "@Module", "Внешние интеграции")
        Component(database_module, "Database Module", "@Module", "Подключения к БД")
        Component(config_module, "Config Module", "@Module", "Конфигурация")
        Component(common_module, "Common Module", "@Module", "Общие сервисы")
        
        ComponentDb(story_entity, "Story Entity", "TypeORM/Prisma", "Сущность истории")
        ComponentDb(user_entity, "User Entity", "TypeORM/Prisma", "Сущность пользователя")
        ComponentDb(place_entity, "Place Entity", "TypeORM/Prisma", "Сущность места")
    }

    System_Ext(nestjs_core, "NestJS Core", "Framework dependencies")
    System_Ext(typeorm, "TypeORM/Prisma", "ORM layer")

    %% Module dependencies
    Rel(app_module, stories_module, "imports", "Module Import")
    Rel(app_module, queries_module, "imports", "Module Import")
    Rel(app_module, moderation_module, "imports", "Module Import")
    Rel(app_module, auth_module, "imports", "Module Import")
    
    Rel(stories_module, integrations_module, "imports", "Module Import")
    Rel(stories_module, database_module, "imports", "Module Import")
    Rel(stories_module, common_module, "imports", "Module Import")
    
    Rel(queries_module, integrations_module, "imports", "Module Import")
    Rel(queries_module, database_module, "imports", "Module Import")
    
    Rel(integrations_module, config_module, "imports", "Module Import")
    Rel(database_module, config_module, "imports", "Module Import")

    %% Entity relationships
    Rel(stories_module, story_entity, "uses", "Entity")
    Rel(auth_module, user_entity, "uses", "Entity")
    Rel(stories_module, place_entity, "uses", "Entity")

    %% Framework dependencies
    Rel(app_module, nestjs_core, "extends", "Framework")
    Rel(story_entity, typeorm, "extends", "ORM")

    UpdateElementStyle(app_module, $fontColor="white", $bgColor="#1976d2")
    UpdateElementStyle(stories_module, $fontColor="white", $bgColor="#4caf50")
    UpdateElementStyle(queries_module, $fontColor="white", $bgColor="#4caf50")
    UpdateElementStyle(moderation_module, $fontColor="white", $bgColor="#4caf50")
    UpdateElementStyle(integrations_module, $fontColor="white", $bgColor="#ff9800")
    UpdateElementStyle(database_module, $fontColor="white", $bgColor="#2196f3")
    UpdateElementStyle(config_module, $fontColor="white", $bgColor="#9c27b0")
```

## 🏗️ Module Structure

### **📁 Project Structure**
```
src/
├── app.module.ts                 # Корневой модуль
├── main.ts                      # Bootstrap файл
│
├── modules/
│   ├── stories/                 # Stories Module
│   │   ├── stories.module.ts
│   │   ├── stories.controller.ts
│   │   ├── stories.service.ts
│   │   ├── dto/
│   │   │   ├── create-story.dto.ts
│   │   │   └── update-story.dto.ts
│   │   └── entities/
│   │       └── story.entity.ts
│   │
│   ├── queries/                 # Queries Module
│   │   ├── queries.module.ts
│   │   ├── queries.controller.ts
│   │   ├── queries.service.ts
│   │   ├── processors/
│   │   │   └── nl2cypher.processor.ts
│   │   └── dto/
│   │       └── natural-query.dto.ts
│   │
│   ├── moderation/             # Moderation Module
│   │   ├── moderation.module.ts
│   │   ├── moderation.controller.ts
│   │   ├── moderation.service.ts
│   │   └── validators/
│   │       ├── ajv.validator.ts
│   │       └── llm.validator.ts
│   │
│   ├── auth/                   # Auth Module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   │   └── jwt.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   │
│   └── integrations/           # Integrations Module
│       ├── integrations.module.ts
│       ├── openai/
│       │   ├── openai.service.ts
│       │   └── openai.config.ts
│       ├── neo4j/
│       │   ├── neo4j.service.ts
│       │   └── neo4j.config.ts
│       ├── pinecone/
│       │   ├── vector.service.ts
│       │   └── pinecone.config.ts
│       └── whisper/
│           └── audio.processor.ts
│
├── database/                   # Database Module
│   ├── database.module.ts
│   ├── migrations/
│   └── seeds/
│
├── common/                     # Common Module
│   ├── common.module.ts
│   ├── services/
│   │   ├── logger.service.ts
│   │   ├── cache.service.ts
│   │   └── file.service.ts
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
│
└── config/                     # Config Module
    ├── config.module.ts
    ├── app.config.ts
    ├── database.config.ts
    └── integrations.config.ts
```

## 📋 Module Definitions

### **App Module**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    StoriesModule,
    QueriesModule,
    ModerationModule,
    IntegrationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

### **Stories Module**
```typescript
@Module({
  imports: [
    IntegrationsModule,
    DatabaseModule,
    CommonModule,
  ],
  controllers: [StoriesController],
  providers: [
    StoriesService,
    {
      provide: 'STORY_REPOSITORY',
      useFactory: (dataSource: DataSource) => dataSource.getRepository(Story),
      inject: [DataSource],
    },
  ],
  exports: [StoriesService],
})
export class StoriesModule {}
```

### **Queries Module**
```typescript
@Module({
  imports: [
    IntegrationsModule,
    DatabaseModule,
    CommonModule,
  ],
  controllers: [QueriesController],
  providers: [
    QueriesService,
    NL2CypherProcessor,
    {
      provide: 'QUERY_CACHE',
      useFactory: (cacheService: CacheService) => cacheService.getClient(),
      inject: [CacheService],
    },
  ],
  exports: [QueriesService, NL2CypherProcessor],
})
export class QueriesModule {}
```

### **Integrations Module**
```typescript
@Module({
  imports: [ConfigModule],
  providers: [
    OpenAIService,
    Neo4jService,
    VectorService,
    AudioProcessor,
    {
      provide: 'OPENAI_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new OpenAI({
          apiKey: configService.get('OPENAI_API_KEY'),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'NEO4J_DRIVER',
      useFactory: (configService: ConfigService) => {
        return neo4j.driver(
          configService.get('NEO4J_URI'),
          neo4j.auth.basic(
            configService.get('NEO4J_USERNAME'),
            configService.get('NEO4J_PASSWORD')
          )
        );
      },
      inject: [ConfigService],
    },
    {
      provide: 'PINECONE_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new PineconeClient({
          apiKey: configService.get('PINECONE_API_KEY'),
          environment: configService.get('PINECONE_ENVIRONMENT'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    OpenAIService,
    Neo4jService,
    VectorService,
    AudioProcessor,
  ],
})
export class IntegrationsModule {}
```

## 🎯 Entity Definitions

### **Story Entity**
```typescript
@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  processedContent?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', array: true, default: [] })
  tags: string[];

  @ManyToOne(() => User, user => user.stories)
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: string;

  @OneToMany(() => StoryPlace, storyPlace => storyPlace.story)
  places: StoryPlace[];

  @OneToMany(() => StoryFile, storyFile => storyFile.story)
  files: StoryFile[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isModerated: boolean;

  @Column({ type: 'enum', enum: ['draft', 'published', 'archived'], default: 'draft' })
  status: 'draft' | 'published' | 'archived';
}
```

### **User Entity**
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'jsonb', nullable: true })
  profile?: UserProfile;

  @OneToMany(() => Story, story => story.author)
  stories: Story[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', array: true, default: ['user'] })
  roles: string[];
}

interface UserProfile {
  avatar?: string;
  bio?: string;
  preferences?: {
    language: string;
    notifications: boolean;
    privacy: 'public' | 'private';
  };
  travelStats?: {
    countriesVisited: number;
    storiesCreated: number;
    totalDistance: number;
  };
}
```

### **Place Entity**
```typescript
@Entity('places')
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  countryCode?: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  coordinates?: Point;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    placeId?: string; // Google Places ID
    placeType?: string[];
    timezone?: string;
    elevation?: number;
  };

  @OneToMany(() => StoryPlace, storyPlace => storyPlace.place)
  stories: StoryPlace[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

## 🔧 Service Dependencies

### **Dependency Injection Graph**
```mermaid
graph TD
    subgraph "Controllers"
        SC[StoriesController]
        QC[QueriesController]
        MC[ModerationController]
    end
    
    subgraph "Business Services"
        SS[StoriesService]
        QS[QueriesService]
        MS[ModerationService]
    end
    
    subgraph "Technical Services"
        OS[OpenAIService]
        NS[Neo4jService]
        VS[VectorService]
        CS[CacheService]
        FS[FileService]
        AP[AudioProcessor]
    end
    
    subgraph "Infrastructure"
        DB[(Database)]
        Cache[(Redis)]
        S3[(S3)]
        OpenAI[OpenAI API]
        Neo4j[Neo4j]
        Pinecone[Pinecone]
    end
    
    SC --> SS
    QC --> QS
    MC --> MS
    
    SS --> OS
    SS --> NS
    SS --> VS
    SS --> FS
    
    QS --> NS
    QS --> VS
    QS --> CS
    
    MS --> OS
    
    OS --> OpenAI
    NS --> Neo4j
    VS --> Pinecone
    CS --> Cache
    FS --> S3
    
    SS --> DB
    QS --> DB
    MS --> DB
```

## 🎯 Key Interfaces

### **Service Interfaces**
```typescript
// LLM Service Interface
export interface ILLMService {
  processText(text: string): Promise<string>;
  createEmbeddings(text: string): Promise<number[]>;
  generateCypher(prompt: string): Promise<string>;
  moderateContent(content: string): Promise<ModerationResult>;
}

// Storage Service Interface
export interface IStorageService {
  createStory(story: CreateStoryDto): Promise<Story>;
  findStoryById(id: string): Promise<Story | null>;
  executeQuery(query: string): Promise<any[]>;
  searchByEmbedding(embedding: number[]): Promise<SearchResult[]>;
}

// Validator Service Interface
export interface IValidatorService {
  validateStory(story: CreateStoryDto): Promise<ValidationResult>;
  validateQuery(query: string): Promise<ValidationResult>;
  sanitizeContent(content: string): Promise<string>;
}
```

### **DTO Definitions**
```typescript
export class CreateStoryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePlaceDto)
  places?: CreatePlaceDto[];

  @IsOptional()
  @IsArray()
  files?: Express.Multer.File[];
}

export class NaturalQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsObject()
  context?: {
    userId?: string;
    location?: {
      lat: number;
      lng: number;
    };
    language?: string;
  };
}
```

Эта C4 архитектура предоставляет полное понимание системы WayMates на всех уровнях - от высокоуровневого контекста до деталей кода. Каждый уровень дает необходимую детализацию для разных аудиторий: stakeholders, архитекторов, разработчиков.

