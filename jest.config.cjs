module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testRunner: 'jest-circus/runner',
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {useESM: true}]
  },
  extensionsToTreatAsEsm: ['.ts'],
  verbose: true
}
