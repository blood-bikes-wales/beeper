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

import { GmailSyncStore } from "../../src/gmail/sync-store";

describe("GmailSyncStore", () => {
	beforeEach(() => {
		mockGet.mockReset();
		mockSave.mockReset();
		mockSave.mockResolvedValue(undefined);
		mockKey.mockClear();
	});

	it("returns no cursor when the mailbox has not been watched", async () => {
		mockGet.mockResolvedValue([undefined]);
		const store = new GmailSyncStore();

		await expect(
			store.getHistoryId("alerts@example.com"),
		).resolves.toBeUndefined();
		expect(mockKey).toHaveBeenCalledWith(["GmailSync", "alerts@example.com"]);
	});

	it("stores the history cursor for a mailbox", async () => {
		const store = new GmailSyncStore();

		await store.saveHistoryId("alerts@example.com", "1234");

		expect(mockSave).toHaveBeenCalledWith({
			key: { path: ["GmailSync", "alerts@example.com"] },
			data: {
				mailbox: "alerts@example.com",
				historyId: "1234",
				updatedAt: expect.any(String),
			},
		});
	});
});
