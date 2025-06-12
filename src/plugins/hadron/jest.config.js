/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../../src/$1',
    '^@ui/(.*)$': '<rootDir>/../../../src/ui/$1',
    '^@core/(.*)$': '<rootDir>/../../../src/core/$1',
    '^@utils/(.*)$': '<rootDir>/../../../src/utils/$1',
    '^@plugins/(.*)$': '<rootDir>/../../../src/plugins/$1',
    '^@tools/(.*)$': '<rootDir>/../../../tools/$1',
    '../../../../ui/(.*)$': '<rootDir>/../../../src/ui/$1',
    '../../../../utils/(.*)$': '<rootDir>/../../../src/utils/$1',
    '../../../../core/(.*)$': '<rootDir>/../../../src/core/$1',
    '../../../../plugins/(.*)$': '<rootDir>/../../../src/plugins/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/__mocks__/**',
    '!**/jest.*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  },
  transformIgnorePatterns: ['/node_modules/(?!(@testing-library)/)']
};
