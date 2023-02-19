module.exports = {
  displayName: "unit test",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  clearMocks: true,
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  moduleFileExtensions: ["ts", "js", "json"],
  modulePathIgnorePatterns: ["/testUtils/.*", "/testData/.*"],
  moduleNameMapper: {
    "^src/(.*)": "<rootDir>/src/$1"
  },
  globals: {
    "ts-jest": {
      isolatedModules: true
    }
  }
};
