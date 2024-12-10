import z from 'zod';
import { getFileContent } from './fs.js';

/**
 * Configuration schema for the Rem bot
 */
const configSchema = z.object({
  github: z.object({
    commits: z.object({
      postToBluesky: z.boolean().default(true),
    }),
  }),
  stats: z.object({
    enable: z.boolean().default(true),
  }),
});

/**
 * Type definition for the configuration
 */
type RemConfig = z.infer<typeof configSchema>;

/**
 * Default configuration values
 */
const defaultConfig: RemConfig = {
  github: {
    commits: {
      postToBluesky: true,
    },
  },
  stats: {
    enable: true,
  },
};

export class ConfigParser {
  private config: RemConfig;

  constructor() {
    this.config = defaultConfig;
  }

  /**
   * Parses a configuration file and returns the configuration object
   * @param filePath Path to the configuration file
   * @returns Promise<RemConfig>
   * @throws Error if the configuration file is invalid
   */
  async parseFile(content: string): Promise<RemConfig> {
    try {
      return this.parseContent(content);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parses configuration content and returns the configuration object
   * @param content Configuration file content
   * @returns RemConfig
   * @throws Error if the configuration content is invalid
   */
  parseContent(content: string): RemConfig {
    const configObj: Record<string, any> = {};
    const lines = content.split('\n');

    let currentSection = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse section headers
      const sectionMatch = trimmedLine.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        continue;
      }

      // Parse key-value pairs
      const kvMatch = trimmedLine.match(/^(.+?)=(.+)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        const keyPath = currentSection ? `${currentSection}.${key}` : key;
        this.setNestedValue(configObj, keyPath.split('.'), this.parseValue(value));
      }
    }

    try {
      // Merge with defaults and validate
      const mergedConfig = this.deepMerge(defaultConfig, configObj);
      return configSchema.parse(mergedConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid configuration: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Gets the current configuration
   * @returns RemConfig
   */
  getConfig(): RemConfig {
    return this.config;
  }

  /**
   * Sets a nested value in an object using a path array
   * @param obj Target object
   * @param path Path array
   * @param value Value to set
   */
  private setNestedValue(obj: Record<string, any>, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      current[key] = current[key] || {};
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  /**
   * Parses a string value into its appropriate type
   * @param value String value to parse
   * @returns Parsed value
   */
  private parseValue(value: string): any {
    const trimmed = value.trim();
    
    // Boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    
    // Number
    if (!isNaN(Number(trimmed))) return Number(trimmed);
    
    // Array (comma-separated)
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(v => this.parseValue(v.trim()));
    }
    
    // String (remove quotes if present)
    return trimmed.replace(/^["'](.+)["']$/, '$1');
  }

  /**
   * Deep merges two objects
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }
}

export const createConfig = async (repository: string, filePath: string = 'rem.conf'): Promise<RemConfig> => {
  const parser = new ConfigParser();
  try {
    // Get the full repository path (owner/repo)
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      console.log('Using default config - invalid repository format');
      return parser.getConfig();
    }
    
    const fullRepoPath = `${owner}/${repo}`;
    const content = await getFileContent(fullRepoPath, filePath);
    return await parser.parseFile(content);
  } catch (error) {
    console.log('Using default config -', error instanceof Error ? error.message : 'unknown error');
    return parser.getConfig();
  }
};

export type { RemConfig };

