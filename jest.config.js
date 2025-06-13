/**
 * Jest configuration for the project
 * This configuration supports both server-side and client-side testing
 * 
 * Key features:
 * - TypeScript support via ts-jest
 * - Path aliases (@/ and @shared/)
 * - Support for both ESM and CommonJS modules
 * - Custom setup file for test environment
 * - Specific transform ignore patterns for various dependencies
 */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',

  transformIgnorePatterns: [
    // Ignore node_modules except for specific packages that need transformation
    'node_modules/(?!(tailwindcss-animate|@tailwindcss/typography|jszip|cheerio)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],

}; 