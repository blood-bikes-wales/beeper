import { getTestServer } from "@google-cloud/functions-framework/testing";
import nock from "nock";
import supertest from "supertest";
import { datastore } from "../../src/datastore";
import dutyTrusteeDirectoryFixture from "../fixtures/directory-search-108235-export.json";
import controllerDirectoryFixture from "../fixtures/directory-search-180262-export.json";
import rotaFixture from "../fixtures/rota-export.json";

const MOCK_CURRENT_DATE = "2024-01-01T10:30:53.697Z";
const MOCK_ROTA_DAY = "2024-01-01";
const MESSAGE_ID = "msg-1";
const WATCH_USER = "alerts@example.com";
const ALERT_FROM = "biketrac@example.com";
const STORED_HISTORY_ID = "1000";
const NOTIFICATION_HISTORY_ID = "2000";
const SMS_BODY = `A new Event has been created for Device KV25DZO NW Tracer - 276125737 at
20/10/2026 13:45:02

The event type is: Movement

The location of the event is Dairy Cottage, Bangor LL57 4BP, UK.`;
const INCOMING_BODY = `Movement
${SMS_BODY}

View Map
<https://u2024964.ct.sendgrid.net/ls/click?upn=example>

To confirm theft call +448000496679.
This is an automated email.`;

const datastoreKeysToClean = [
	datastore.key(["IncomingRequest", MESSAGE_ID]),
	datastore.key(["GmailSync", WATCH_USER]),
	datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
	datastore.key(["ThreeRingsCache", "volunteer-180262"]),
	datastore.key(["ThreeRingsCache", "volunteer-108235"]),
];

const mockMessagesCreate = jest.fn().mockResolvedValue({ sid: "SM_mock" });

function presentKey(key: unknown): unknown[] {
	if (!key) {
		return [];
	}

	return [key];
}

jest.mock("twilio", () => {
	const twilioFn = jest.fn(() => ({
		messages: {
			create: mockMessagesCreate,
		},
	}));
	return {
		__esModule: true,
		default: twilioFn,
	};
});

jest.mock("../../src/utility", () => {
	const actual = jest.requireActual(
		"../../src/utility",
	) as typeof import("../../src/utility");
	const { redactPhoneNumber, formatPhoneNumber } = actual.default;

	return {
		__esModule: true,
		default: {
			getCurrentDate: jest.fn(() => MOCK_CURRENT_DATE),
			redactPhoneNumber,
			formatPhoneNumber,
		},
	};
});

function gmailPushBody(historyId: string, emailAddress = WATCH_USER) {
	const data = Buffer.from(
		JSON.stringify({ emailAddress, historyId }),
	).toString("base64url");
	return {
		message: {
			data,
			messageId: "2070443601311540",
			publishTime: MOCK_CURRENT_DATE,
		},
		subscription: "projects/beeper-local/subscriptions/beeper-gmail-push",
	};
}

function postGmailPush(
	historyId = NOTIFICATION_HISTORY_ID,
	emailAddress = WATCH_USER,
) {
	return supertest(getTestServer("receiveMessage"))
		.post("/")
		.send(gmailPushBody(historyId, emailAddress));
}

function gmailMessage(body: string, from = `BikeTrac <${ALERT_FROM}>`) {
	return {
		id: MESSAGE_ID,
		payload: {
			mimeType: "text/plain",
			headers: [{ name: "From", value: from }],
			body: { data: Buffer.from(body).toString("base64url") },
		},
	};
}

function nockGmailAlert(body = INCOMING_BODY, from?: string) {
	nock("https://gmail.googleapis.com")
		.get("/gmail/v1/users/me/history")
		.query(true)
		.reply(200, {
			history: [
				{ id: "1500", messagesAdded: [{ message: { id: MESSAGE_ID } }] },
			],
			historyId: NOTIFICATION_HISTORY_ID,
		});
	nock("https://gmail.googleapis.com")
		.get(`/gmail/v1/users/me/messages/${MESSAGE_ID}`)
		.query(true)
		.reply(200, gmailMessage(body, from));
}

function nockThreeRings() {
	nock("https://www.3r.org.uk")
		.get("/stats/export_rotas.json")
		.query({ start_date: MOCK_ROTA_DAY, end_date: MOCK_ROTA_DAY })
		.reply(200, rotaFixture);

	nock("https://www.3r.org.uk")
		.get("/directory/180262?format=json")
		.reply(200, controllerDirectoryFixture);

	nock("https://www.3r.org.uk")
		.get("/directory/108235?format=json")
		.reply(200, dutyTrusteeDirectoryFixture);
}

async function seedHistory(historyId = STORED_HISTORY_ID) {
	await datastore.save({
		key: datastore.key(["GmailSync", WATCH_USER]),
		data: {
			mailbox: WATCH_USER,
			historyId,
			updatedAt: MOCK_CURRENT_DATE,
		},
	});
}

describe("receiveMessage", () => {
	beforeAll(() => {
		require("../../src/functions/receiveMessage");
		nock("https://oauth2.googleapis.com")
			.post("/token")
			.reply(200, {
				access_token: "ya29.test",
				expires_in: 3600,
				token_type: "Bearer",
			})
			.persist();
	});

	beforeEach(async () => {
		const ancestor = datastore.key(["IncomingRequest", MESSAGE_ID]);
		const [outgoing] = await datastore.runQuery(
			datastore.createQuery("OutgoingMessage").hasAncestor(ancestor),
		);
		const outgoingKeys = outgoing.flatMap((entity) =>
			presentKey(entity[datastore.KEY]),
		);
		await datastore.delete([...datastoreKeysToClean, ...outgoingKeys]);
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
		mockMessagesCreate.mockClear();
	});

	it("forwards the email plain text to the duty trustee", async () => {
		await seedHistory();
		nockThreeRings();
		nockGmailAlert();

		await postGmailPush().expect(204);

		expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
		expect(mockMessagesCreate).toHaveBeenCalledWith({
			body: SMS_BODY,
			from: "BBWales",
			to: "+447700900989",
		});

		const [incomingRequest] = await datastore.get(
			datastore.key(["IncomingRequest", MESSAGE_ID]),
		);
		expect(incomingRequest).toMatchObject({
			messageId: MESSAGE_ID,
			body: SMS_BODY,
			from: ALERT_FROM,
		});
		expect(incomingRequest.expiresAt).toEqual(
			new Date("2024-01-29T10:30:53.697Z"),
		);

		const [outgoingMessages] = await datastore.runQuery(
			datastore
				.createQuery("OutgoingMessage")
				.hasAncestor(datastore.key(["IncomingRequest", MESSAGE_ID])),
		);
		expect(outgoingMessages).toHaveLength(1);
		expect(outgoingMessages[0]?.expiresAt).toEqual(
			new Date("2024-01-29T10:30:53.697Z"),
		);

		const [sync] = await datastore.get(
			datastore.key(["GmailSync", WATCH_USER]),
		);
		expect(sync.historyId).toBe(NOTIFICATION_HISTORY_ID);

		const [rotaCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
		);
		expect(rotaCache).toBeDefined();
		expect(rotaCache.expiresAt).toEqual(new Date("2024-01-02T10:30:53.697Z"));

		const [controllerCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", "volunteer-180262"]),
		);
		expect(controllerCache).toBeDefined();
		expect(controllerCache.expiresAt).toEqual(
			new Date("2024-01-02T10:30:53.697Z"),
		);

		const [trusteeCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", "volunteer-108235"]),
		);
		expect(trusteeCache).toBeDefined();
		expect(trusteeCache.expiresAt).toEqual(
			new Date("2024-01-02T10:30:53.697Z"),
		);
	});

	it("acks a notification for a different mailbox", async () => {
		await postGmailPush(NOTIFICATION_HISTORY_ID, "other@example.com").expect(
			204,
		);

		expect(mockMessagesCreate).not.toHaveBeenCalled();
	});

	it("acks a notification that is not newer than the stored cursor", async () => {
		await seedHistory(NOTIFICATION_HISTORY_ID);

		await postGmailPush(NOTIFICATION_HISTORY_ID).expect(204);

		expect(mockMessagesCreate).not.toHaveBeenCalled();
		expect(
			nock
				.pendingMocks()
				.filter((mock) => mock.includes("gmail.googleapis.com")),
		).toHaveLength(0);
	});

	it("does not text mail from another sender", async () => {
		await seedHistory();
		nockGmailAlert("hello", "Someone <other@example.com>");

		await postGmailPush().expect(204);

		expect(mockMessagesCreate).not.toHaveBeenCalled();
		const [sync] = await datastore.get(
			datastore.key(["GmailSync", WATCH_USER]),
		);
		expect(sync.historyId).toBe(NOTIFICATION_HISTORY_ID);
	});

	it("advances past a message deleted before it could be read", async () => {
		await seedHistory();
		nock("https://gmail.googleapis.com")
			.get("/gmail/v1/users/me/history")
			.query(true)
			.reply(200, {
				history: [
					{ id: "1500", messagesAdded: [{ message: { id: MESSAGE_ID } }] },
				],
				historyId: NOTIFICATION_HISTORY_ID,
			});
		nock("https://gmail.googleapis.com")
			.get(`/gmail/v1/users/me/messages/${MESSAGE_ID}`)
			.query(true)
			.reply(404, {
				error: { code: 404, message: "Requested entity was not found." },
			});

		await postGmailPush().expect(204);

		expect(mockMessagesCreate).not.toHaveBeenCalled();
		const [sync] = await datastore.get(
			datastore.key(["GmailSync", WATCH_USER]),
		);
		expect(sync.historyId).toBe(NOTIFICATION_HISTORY_ID);
	});

	it("uses cached Three Rings data on a repeat request", async () => {
		await seedHistory();
		await datastore.save([
			cacheEntity(`rota-${MOCK_ROTA_DAY}`, rotaFixture),
			cacheEntity("volunteer-180262", controllerDirectoryFixture),
			cacheEntity("volunteer-108235", dutyTrusteeDirectoryFixture),
		]);
		nockGmailAlert("Event Alert: repeat request");

		await postGmailPush().expect(204);

		expect(
			nock.pendingMocks().filter((mock) => mock.includes("3r.org.uk")),
		).toHaveLength(0);
		expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
	});

	it("refetches Three Rings rota data when the cache TTL has expired", async () => {
		await seedHistory();
		await datastore.save([
			{
				key: datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
				data: [
					{
						name: "data",
						value: JSON.stringify({ shifts: [] }),
						excludeFromIndexes: true,
					},
					{ name: "expiresAt", value: new Date("2024-01-01T10:30:53.697Z") },
				],
			},
			cacheEntity("volunteer-180262", controllerDirectoryFixture),
			cacheEntity("volunteer-108235", dutyTrusteeDirectoryFixture),
		]);
		nock("https://www.3r.org.uk")
			.get("/stats/export_rotas.json")
			.query({ start_date: MOCK_ROTA_DAY, end_date: MOCK_ROTA_DAY })
			.reply(200, rotaFixture);
		nockGmailAlert("Event Alert: expired cache");

		await postGmailPush().expect(204);

		expect(
			nock.pendingMocks().filter((mock) => mock.includes("3r.org.uk")),
		).toHaveLength(0);
		expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

		const [rotaCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
		);
		expect(rotaCache.expiresAt).toEqual(new Date("2024-01-02T10:30:53.697Z"));
		expect(JSON.parse(rotaCache.data as string)).toEqual(rotaFixture);
	});
});

function cacheEntity(name: string, value: unknown) {
	return {
		key: datastore.key(["ThreeRingsCache", name]),
		data: [
			{ name: "data", value: JSON.stringify(value), excludeFromIndexes: true },
			{ name: "expiresAt", value: new Date("2024-01-02T10:30:53.697Z") },
		],
	};
}
