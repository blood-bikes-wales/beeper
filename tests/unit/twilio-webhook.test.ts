import type { Request } from "@google-cloud/functions-framework";
import twilio from "twilio";
import { isValidTwilioWebhook } from "../../src/twilio-webhook";

jest.mock("../../src/config", () => ({
	__esModule: true,
	default: {
		getTwilioAuthToken: () => "test-auth-token",
		getTwilioWebhookUrl: () => "https://example.com/webhook",
	},
}));

describe("isValidTwilioWebhook", () => {
	it("returns true when signature matches raw form body params", () => {
		const params = {
			Body: "Hello",
			From: "+15551234567",
			SmsMessageSid: "SM123",
		};
		const url = "https://example.com/webhook";
		const signature = twilio.getExpectedTwilioSignature(
			"test-auth-token",
			url,
			params,
		);
		const rawBody = new URLSearchParams(params).toString();

		const req = {
			get(name: string) {
				if (name === "x-twilio-signature") return signature;
				if (name === "content-type")
					return "application/x-www-form-urlencoded";
				return undefined;
			},
			body: params,
			rawBody: Buffer.from(rawBody),
		} as Request & { rawBody: Buffer };

		expect(isValidTwilioWebhook(req)).toBe(true);
	});

	it("returns false when signature is missing", () => {
		const req = {
			get: () => undefined,
			body: {},
		} as Request;

		expect(isValidTwilioWebhook(req)).toBe(false);
	});

	it("returns false when signature does not match", () => {
		const params = { Body: "Hello", From: "+15551234567" };
		const rawBody = new URLSearchParams(params).toString();

		const req = {
			get(name: string) {
				if (name === "x-twilio-signature") return "invalid-signature";
				if (name === "content-type")
					return "application/x-www-form-urlencoded";
				return undefined;
			},
			body: params,
			rawBody: Buffer.from(rawBody),
		} as Request & { rawBody: Buffer };

		expect(isValidTwilioWebhook(req)).toBe(false);
	});
});
