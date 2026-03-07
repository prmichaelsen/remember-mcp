export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/*.e2e.ts'],
  testTimeout: 60000, // 60 seconds for real API calls
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e.ts',
    '!src/types/**/*.ts',
    '!src/index.ts',
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
