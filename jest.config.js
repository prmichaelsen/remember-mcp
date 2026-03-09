export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  maxWorkers: '50%',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e.ts',
    '!src/index.ts',
    '!src/types/**/*.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@prmichaelsen/remember-core$': '<rootDir>/node_modules/@prmichaelsen/remember-core/dist/index.js',
    '^@prmichaelsen/remember-core/(.*)$': '<rootDir>/node_modules/@prmichaelsen/remember-core/dist/$1/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@prmichaelsen/remember-core)/)',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
    'node_modules/@prmichaelsen/remember-core/.+\\.js$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};
