/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/types/**/*',
    '!src/ui/**/*' // UI will be tested separately
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@alexandria/(.*)$': '<rootDir>/../../src/$1',
    '^@ui/(.*)$': '<rootDir>/../../src/client/components/$1',
    '^@core/(.*)$': '<rootDir>/../../src/core/$1',
    '^@utils/(.*)$': '<rootDir>/../../src/utils/$1',
    '^@types/(.*)$': '<rootDir>/../../src/types/$1'
  },
  testTimeout: 10000,
  verbose: true,
  maxWorkers: '50%'
};