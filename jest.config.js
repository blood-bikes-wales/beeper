/** @type {import("jest").Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/tests"],
	setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.test.json",
			},
		],
	},
	moduleNameMapper: {
		// Force the CommonJS build of axios so the http adapter is available for nock to intercept.
		// https://github.com/nock/nock#axios
		"^axios$": require.resolve("axios"),
	},
};
