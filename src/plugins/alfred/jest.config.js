/**
 * Jest configuration for Alfred plugin tests
 */

module.exports = {
  displayName: 'Alfred Plugin Tests',
  preset: '../../../jest.config.js',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/ui/**/*.test.{ts,tsx}'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '^@alfred/(.*)$': '<rootDir>/src/$1',
    '^@alfred/ui/(.*)$': '<rootDir>/ui/$1',
    '^@core/(.*)$': '<rootDir>/../../core/$1',
    '^@client/(.*)$': '<rootDir>/../../client/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        }
      }
    ]
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/', '/__mocks__/', '/dist/', '.d.ts$'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'ui/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!ui/**/index.ts',
    '!**/*.test.{ts,tsx}',
    '!**/__tests__/**'
  ],
  testTimeout: 10000,
  maxWorkers: '50%',
  clearMocks: true,
  restoreMocks: true
};
