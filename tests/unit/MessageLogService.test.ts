import type { Key } from "@google-cloud/datastore";

const mockSave = jest.fn();
const mockKey = jest.fn((path: unknown[]) => ({ path }));

jest.mock("../../src/datastore", () => ({
	datastore: {
		key: (path: unknown[]) => mockKey(path),
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

import { MessageLogService } from "../../src/service/message-log.service";

const body = {
	SmsMessageSid: "SM_test",
	Body: "Event Alert",
	From: "+447896843243",
};

describe("MessageLogService", () => {
	beforeEach(() => {
		mockSave.mockReset();
		mockSave.mockResolvedValue(undefined);
		mockKey.mockClear();
	});

	it("stores incoming requests with a 28-day expiry", async () => {
		const service = new MessageLogService();

		const key = await service.logIncomingRequest(body);

		expect(key).toEqual({ path: ["IncomingRequest", "SM_test"] });
		expect(mockSave).toHaveBeenCalledWith({
			key: { path: ["IncomingRequest", "SM_test"] },
			data: {
				smsMessageSid: "SM_test",
				body: "Event Alert",
				from: "+447896843243",
				receivedAt: expect.any(String),
				expiresAt: new Date("2024-01-29T10:30:53.697Z"),
			},
		});
	});

	it("stores outgoing messages with a 28-day expiry", async () => {
		const service = new MessageLogService();
		const requestKey = {
			path: ["IncomingRequest", "SM_test"],
		} as unknown as Key;

		await service.logOutgoingMessage(
			requestKey,
			"+447700900989",
			"+447896843243",
			"Event Alert",
		);

		expect(mockSave).toHaveBeenCalledWith({
			key: {
				path: ["IncomingRequest", "SM_test", "OutgoingMessage"],
			},
			data: {
				to: "+447700900989",
				from: "+447896843243",
				body: "Event Alert",
				sentAt: expect.any(String),
				expiresAt: new Date("2024-01-29T10:30:53.697Z"),
			},
		});
	});
});
