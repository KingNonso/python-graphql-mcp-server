export interface MCPConfig {
  endpoint: string;
  headers: Record<string, string>;
  allowMutations: boolean;
  name: string;
  schema?: string;
}

export interface EnvironmentConfig {
  ENDPOINT: string;
  HEADERS: string;
  ALLOW_MUTATIONS: string;
  NAME: string;
  SCHEMA?: string;

  // Derived/parsed values
  parsedHeaders: Record<string, string>;
  allowMutations: boolean;
  hasLocalSchema: boolean;
}
