import { getTestServer } from "@google-cloud/functions-framework/testing";
import nock from "nock";
import supertest from "supertest";
import { datastore } from "../../src/datastore";

const WATCH_USER = "watch-renew@example.com";
const TOPIC = "projects/beeper-local/topics/beeper-gmail";

jest.mock("../../src/utility", () => {
	const actual = jest.requireActual(
		"../../src/utility",
	) as typeof import("../../src/utility");
	const { redactPhoneNumber, formatPhoneNumber } = actual.default;

	return {
		__esModule: true,
		default: {
			getCurrentDate: jest.fn(() => "2024-01-01T10:30:53.697Z"),
			redactPhoneNumber,
			formatPhoneNumber,
		},
	};
});

function nockWatch(historyId: string) {
	nock("https://gmail.googleapis.com")
		.post("/gmail/v1/users/me/watch", {
			topicName: TOPIC,
			labelIds: ["INBOX"],
			labelFilterBehavior: "INCLUDE",
		})
		.reply(200, { historyId, expiration: "1431990098200" });
}

describe("renewGmailWatch", () => {
	const previousWatchUser = process.env.GMAIL_WATCH_USER;

	beforeAll(() => {
		process.env.GMAIL_WATCH_USER = WATCH_USER;
		require("../../src/functions/renewGmailWatch");
		nock("https://oauth2.googleapis.com")
			.post("/token")
			.reply(200, {
				access_token: "ya29.test",
				expires_in: 3600,
				token_type: "Bearer",
			})
			.persist();
	});

	afterAll(() => {
		process.env.GMAIL_WATCH_USER = previousWatchUser;
	});

	beforeEach(async () => {
		await datastore.delete(datastore.key(["GmailSync", WATCH_USER]));
	});

	afterEach(() => {
		nock.cleanAll();
		nock("https://oauth2.googleapis.com")
			.post("/token")
			.reply(200, {
				access_token: "ya29.test",
				expires_in: 3600,
				token_type: "Bearer",
			})
			.persist();
	});

	it("stores the watch history id when the mailbox has no cursor", async () => {
		nockWatch("555");

		await supertest(getTestServer("renewGmailWatch"))
			.post("/")
			.send({})
			.expect(204);

		const [sync] = await datastore.get(
			datastore.key(["GmailSync", WATCH_USER]),
		);
		expect(sync.historyId).toBe("555");
	});

	it("does not reset an existing history cursor", async () => {
		await datastore.save({
			key: datastore.key(["GmailSync", WATCH_USER]),
			data: {
				mailbox: WATCH_USER,
				historyId: "100",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
		});
		nockWatch("999");

		await supertest(getTestServer("renewGmailWatch"))
			.post("/")
			.send({})
			.expect(204);

		const [sync] = await datastore.get(
			datastore.key(["GmailSync", WATCH_USER]),
		);
		expect(sync.historyId).toBe("100");
	});
});
