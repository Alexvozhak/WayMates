````# ⚙️ Конкретные реализации WayMates
````
````## 🧠 LLM Провайдеры
````
````### OpenAILLM
````
````\`\`\`typescript
````class OpenAILLM implements ILLM {
````  private apiKey: string;
````  private model: string;
````  
````  constructor(config: OpenAIConfig) {
````    this.apiKey = config.apiKey;
````    this.model = config.model;
````  }
````  
````  async generateResponse(prompt: string): Promise<string> {
````    // OpenAI API вызов
````  }
````  
````  async embedText(text: string): Promise<number[]> {
````    // OpenAI Embeddings API
````  }
````}
````\`\`\`
````
````### SonnetLLM
````
````\`\`\`typescript
````class SonnetLLM implements ILLM {
````  private apiKey: string;
````  private model: string;
````  
````  constructor(config: SonnetConfig) {
````    this.apiKey = config.apiKey;
````    this.model = config.model;
````  }
````  
````  async generateResponse(prompt: string): Promise<string> {
````    // Anthropic Claude API
````  }
````  
````  async embedText(text: string): Promise<number[]> {
````    // Anthropic Embeddings
````  }
````}
````\`\`\`
````
````## 🔄 DI Container
````
````\`\`\`typescript
````class ServiceContainer {
````  private services: Map<string, any> = new Map();
````  
````  register<T>(token: string, implementation: T): void {
````    this.services.set(token, implementation);
````  }
````  
````  resolve<T>(token: string): T {
````    const service = this.services.get(token);
````    if (!service) {
````      throw new Error(\`Service ${token} not found\`);
````    }
````    return service;
````  }
````}
````\`\`\`
