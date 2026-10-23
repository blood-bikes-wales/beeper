import type { gmail_v1 } from "@googleapis/gmail";
import {
	listMessageIdsToRead,
	readMatchingAlert,
} from "../../src/gmail/history";
import {
	emailAddress,
	fromAddress,
	plainTextFromPayload,
	senderMatches,
} from "../../src/gmail/parse-message";
import { decodeGmailPush, isNewerHistoryId } from "../../src/gmail/push";

describe("Gmail message parsing", () => {
	it("reads an address from a display-name From header", () => {
		expect(emailAddress("BikeTrac <Alerts@Example.com>")).toBe(
			"alerts@example.com",
		);
		expect(
			fromAddress([{ name: "From", value: "BikeTrac <alerts@example.com>" }]),
		).toBe("alerts@example.com");
	});

	it("matches the configured sender case-insensitively", () => {
		expect(senderMatches("alerts@example.com", "Alerts@Example.com")).toBe(
			true,
		);
		expect(senderMatches("other@example.com", "alerts@example.com")).toBe(
			false,
		);
	});

	it("uses the first plain-text part", () => {
		const text = plainTextFromPayload({
			mimeType: "multipart/alternative",
			parts: [
				{
					mimeType: "text/plain",
					body: {
						data: Buffer.from("Event Alert: bike").toString("base64url"),
					},
				},
				{
					mimeType: "text/html",
					body: {
						data: Buffer.from("<p>Event Alert: bike</p>").toString("base64url"),
					},
				},
			],
		});

		expect(text).toBe("Event Alert: bike");
	});

	it("skips messages with no plain-text body", () => {
		expect(
			plainTextFromPayload({
				mimeType: "text/html",
				body: { data: Buffer.from("<p>x</p>").toString("base64url") },
			}),
		).toBeUndefined();
	});
});

describe("Gmail push notifications", () => {
	it("decodes the Pub/Sub envelope", () => {
		const data = Buffer.from(
			JSON.stringify({ emailAddress: "alerts@example.com", historyId: 2000 }),
		).toString("base64url");

		expect(decodeGmailPush({ message: { data } })).toEqual({
			emailAddress: "alerts@example.com",
			historyId: "2000",
		});
	});

	it("rejects a body that is not a Gmail notification", () => {
		expect(() =>
			decodeGmailPush({
				message: { data: Buffer.from("{}").toString("base64url") },
			}),
		).toThrow("Invalid Gmail push notification");
	});

	it("treats a missing cursor as older than the notification", () => {
		expect(isNewerHistoryId("10", undefined)).toBe(true);
		expect(isNewerHistoryId("10", "10")).toBe(false);
		expect(isNewerHistoryId("11", "10")).toBe(true);
		expect(isNewerHistoryId("10", "9007199254740993")).toBe(false);
	});
});

describe("Gmail history", () => {
	it("lists message ids added since the stored cursor", async () => {
		const list = jest.fn().mockResolvedValue({
			data: {
				history: [
					{
						messagesAdded: [
							{ message: { id: "msg-1" } },
							{ message: { id: "msg-2" } },
						],
					},
				],
			},
		});
		const gmail = fakeGmail({ list });

		await expect(
			listMessageIdsToRead(gmail, "100", "biketrac@example.com"),
		).resolves.toEqual(["msg-1", "msg-2"]);
		expect(list).toHaveBeenCalledWith({
			userId: "me",
			startHistoryId: "100",
			historyTypes: ["messageAdded"],
			labelId: "INBOX",
		});
	});

	it("falls back to a recent search when the cursor is too old", async () => {
		const list = jest.fn().mockRejectedValue({ code: 404 });
		const messagesList = jest.fn().mockResolvedValue({
			data: { messages: [{ id: "msg-recent" }] },
		});
		const gmail = fakeGmail({ list, messagesList });

		await expect(
			listMessageIdsToRead(gmail, "1", "biketrac@example.com"),
		).resolves.toEqual(["msg-recent"]);
		expect(messagesList).toHaveBeenCalledWith({
			userId: "me",
			q: "from:biketrac@example.com newer_than:1d",
			labelIds: ["INBOX"],
			maxResults: 5,
		});
	});

	it("returns an alert only when the sender matches and plain text exists", async () => {
		const get = jest.fn().mockResolvedValue({
			data: {
				payload: {
					mimeType: "text/plain",
					headers: [{ name: "From", value: "BikeTrac <biketrac@example.com>" }],
					body: {
						data: Buffer.from(
							"Movement\nA new Event has been created for Device KV25DZO.\n\nView Map",
						).toString("base64url"),
					},
				},
			},
		});
		const gmail = fakeGmail({ get });

		await expect(
			readMatchingAlert(gmail, "msg-1", "biketrac@example.com"),
		).resolves.toEqual({
			id: "msg-1",
			from: "biketrac@example.com",
			body: "A new Event has been created for Device KV25DZO.",
			matched: true,
		});
	});

	it("ignores mail from another sender", async () => {
		const get = jest.fn().mockResolvedValue({
			data: {
				payload: {
					mimeType: "text/plain",
					headers: [{ name: "From", value: "other@example.com" }],
					body: { data: Buffer.from("hello").toString("base64url") },
				},
			},
		});

		await expect(
			readMatchingAlert(fakeGmail({ get }), "msg-1", "biketrac@example.com"),
		).resolves.toBeUndefined();
	});

	it("skips a message that was deleted before it could be read", async () => {
		const get = jest.fn().mockRejectedValue({ code: 404 });

		await expect(
			readMatchingAlert(fakeGmail({ get }), "msg-1", "biketrac@example.com"),
		).resolves.toBeUndefined();
	});

	it("rethrows other errors when reading a message", async () => {
		const get = jest.fn().mockRejectedValue({ code: 500 });

		await expect(
			readMatchingAlert(fakeGmail({ get }), "msg-1", "biketrac@example.com"),
		).rejects.toEqual({ code: 500 });
	});
});

function fakeGmail(handlers: {
	list?: jest.Mock;
	messagesList?: jest.Mock;
	get?: jest.Mock;
}): gmail_v1.Gmail {
	return {
		users: {
			history: { list: handlers.list ?? jest.fn() },
			messages: {
				list: handlers.messagesList ?? jest.fn(),
				get: handlers.get ?? jest.fn(),
			},
		},
	} as unknown as gmail_v1.Gmail;
}
