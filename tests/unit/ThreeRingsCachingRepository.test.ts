import type { IThreeRingsRepository } from "../../src/repository/IThreeRingsRepository";
import type { RotaResponseType, VolunteerResponseType } from "../../src/types";

const mockGet = jest.fn();
const mockSave = jest.fn();
const mockKey = jest.fn((path: unknown[]) => ({ path }));

jest.mock("../../src/datastore", () => ({
	datastore: {
		key: (path: unknown[]) => mockKey(path),
		get: (...args: unknown[]) => mockGet(...args),
		save: (...args: unknown[]) => mockSave(...args),
	},
}));

const MOCK_NOW = "2024-01-01T10:30:53.697Z";

jest.mock("../../src/utility", () => {
	const actual = jest.requireActual(
		"../../src/utility",
	) as typeof import("../../src/utility");
	return {
		__esModule: true,
		default: {
			getCurrentDate: jest.fn(() => MOCK_NOW),
			redactPhoneNumber: actual.default.redactPhoneNumber,
			formatPhoneNumber: actual.default.formatPhoneNumber,
		},
	};
});

import { ThreeRingsCachingRepository } from "../../src/repository/ThreeRingsCachingRepository";

const rotaFixture = { shifts: [{ id: 1 }] } as unknown as RotaResponseType;
const volunteerFixture = {
	volunteer: { id: 180262 },
} as unknown as VolunteerResponseType;

function buildInner(): IThreeRingsRepository {
	return {
		getRotaExportForDay: jest.fn().mockResolvedValue(rotaFixture),
		getVolunteerDetails: jest.fn().mockResolvedValue(volunteerFixture),
	};
}

describe("ThreeRingsCachingRepository", () => {
	beforeEach(() => {
		mockGet.mockReset();
		mockSave.mockReset();
		mockKey.mockClear();
	});

	describe("getRotaExportForDay", () => {
		it("fetches and stores a 24-hour expiry when the cache is empty", async () => {
			mockGet.mockResolvedValue([]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getRotaExportForDay(MOCK_NOW);

			expect(result).toEqual(rotaFixture);
			expect(inner.getRotaExportForDay).toHaveBeenCalledWith("2024-01-01");
			expect(mockSave).toHaveBeenCalledWith({
				key: { path: ["ThreeRingsCache", "rota-2024-01-01"] },
				data: [
					{
						name: "data",
						value: JSON.stringify(rotaFixture),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-02T10:30:53.697Z"),
					},
				],
			});
		});

		it("returns a cached rota that has not expired", async () => {
			mockGet.mockResolvedValue([
				{
					data: JSON.stringify(rotaFixture),
					expiresAt: new Date("2024-01-02T10:30:53.697Z"),
				},
			]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getRotaExportForDay("2024-01-01");

			expect(result).toEqual(rotaFixture);
			expect(inner.getRotaExportForDay).not.toHaveBeenCalled();
			expect(mockSave).not.toHaveBeenCalled();
		});

		it("refetches when the cached rota has expired", async () => {
			mockGet.mockResolvedValue([
				{
					data: JSON.stringify({ shifts: [] }),
					expiresAt: new Date("2024-01-01T10:30:53.697Z"),
				},
			]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getRotaExportForDay("2024-01-01");

			expect(result).toEqual(rotaFixture);
			expect(inner.getRotaExportForDay).toHaveBeenCalledTimes(1);
			expect(mockSave).toHaveBeenCalledTimes(1);
		});

		it("refetches legacy rota entries that have no expiresAt", async () => {
			mockGet.mockResolvedValue([{ data: JSON.stringify({ shifts: [] }) }]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getRotaExportForDay("2024-01-01");

			expect(result).toEqual(rotaFixture);
			expect(inner.getRotaExportForDay).toHaveBeenCalledTimes(1);
		});
	});

	describe("getVolunteerDetails", () => {
		it("fetches and stores a 24-hour expiry when the cache is empty", async () => {
			mockGet.mockResolvedValue([]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			await repo.getVolunteerDetails(180262);

			expect(inner.getVolunteerDetails).toHaveBeenCalledWith(180262);
			expect(mockSave).toHaveBeenCalledWith({
				key: { path: ["ThreeRingsCache", "volunteer-180262"] },
				data: [
					{
						name: "data",
						value: JSON.stringify(volunteerFixture),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-02T10:30:53.697Z"),
					},
				],
			});
		});

		it("returns a cached volunteer that has not expired", async () => {
			mockGet.mockResolvedValue([
				{
					data: JSON.stringify(volunteerFixture),
					expiresAt: new Date("2024-01-02T10:30:53.697Z"),
				},
			]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getVolunteerDetails(180262);

			expect(result).toEqual(volunteerFixture);
			expect(inner.getVolunteerDetails).not.toHaveBeenCalled();
			expect(mockSave).not.toHaveBeenCalled();
		});

		it("refetches when the cached volunteer has expired", async () => {
			mockGet.mockResolvedValue([
				{
					data: JSON.stringify({ volunteer: { id: 0 } }),
					expiresAt: new Date("2024-01-01T10:30:53.697Z"),
				},
			]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getVolunteerDetails(180262);

			expect(result).toEqual(volunteerFixture);
			expect(inner.getVolunteerDetails).toHaveBeenCalledTimes(1);
			expect(mockSave).toHaveBeenCalledTimes(1);
		});

		it("refetches legacy volunteer entries that have no expiresAt", async () => {
			mockGet.mockResolvedValue([{ data: JSON.stringify({ volunteer: {} }) }]);
			const inner = buildInner();
			const repo = new ThreeRingsCachingRepository(inner);

			const result = await repo.getVolunteerDetails(180262);

			expect(result).toEqual(volunteerFixture);
			expect(inner.getVolunteerDetails).toHaveBeenCalledTimes(1);
		});
	});
});
