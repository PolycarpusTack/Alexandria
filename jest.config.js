/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  modulePaths: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
    '^@tools/(.*)$': '<rootDir>/tools/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
    '!src/plugins/**/ui/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testResultsProcessor: 'jest-sonar-reporter',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }]
  },
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', 'integration', 'e2e'],
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@ui/(.*)$': '<rootDir>/src/ui/$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
        '^@tools/(.*)$': '<rootDir>/tools/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
      },
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/__tests__/integration/**/*.test.{ts,tsx}'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@ui/(.*)$': '<rootDir>/src/ui/$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
        '^@tools/(.*)$': '<rootDir>/tools/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
      },
    }
  ]
};