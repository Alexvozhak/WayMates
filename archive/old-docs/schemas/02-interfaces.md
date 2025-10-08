````# 🔌 Детальные интерфейсы WayMates
````
````## 🎯 Полиморфные интерфейсы
````
````### ILLM - Языковые модели
````
````\`\`\`typescript
````interface ILLM {
````  generateResponse(prompt: string): Promise<string>;
````  embedText(text: string): Promise<number[]>;
````  transcribeAudio?(audio: Buffer): Promise<string>;
````}
````\`\`\`
````
````**Реализации:**
````- \`OpenAILLM\` - GPT-4, text-embedding-ada-002
````- \`SonnetLLM\` - Claude Sonnet
````- \`WhisperLLM\` - локальный Whisper.cpp
````
````### IStorage - Хранение данных
````
````\`\`\`typescript
````interface IStorage {
````  storeStory(story: Story): Promise<string>;
````  retrieveStory(id: string): Promise<Story>;
````  searchStories(query: SearchQuery): Promise<Story[]>;
````  storeVector(embedding: number[], metadata: any): Promise<string>;
````}
````\`\`\`
````
````## 📊 UML диаграмма интерфейсов
````
````\`\`\`mermaid
````classDiagram
````    %% Core Interfaces
````    class ILLM {
````        <<interface>>
````        +generateResponse(prompt: string): Promise<string>
````        +embedText(text: string): Promise<number[]>
````        +transcribeAudio?(audio: Buffer): Promise<string>
````    }
````    
````    class IStorage {
````        <<interface>>
````        +storeStory(story: Story): Promise<string>
````        +retrieveStory(id: string): Promise<Story>
````        +searchStories(query: SearchQuery): Promise<Story[]>
````        +storeVector(embedding: number[], metadata: any): Promise<string>
````    }
````\`\`\`
