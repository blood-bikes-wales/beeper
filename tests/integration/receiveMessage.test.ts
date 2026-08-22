import { getTestServer } from "@google-cloud/functions-framework/testing";
import nock from "nock";
import supertest from "supertest";
import { datastore } from "../../src/datastore";
import dutyTrusteeDirectoryFixture from "../fixtures/directory-search-108235-export.json";
import controllerDirectoryFixture from "../fixtures/directory-search-180262-export.json";
import rotaFixture from "../fixtures/rota-export.json";

const MOCK_CURRENT_DATE = "2024-01-01T10:30:53.697Z";
const MOCK_ROTA_DAY = "2024-01-01";
const SMS_MESSAGE_SID = "SM7068ddb127c539915189_test";

// Datastore keys touched during each test run.
const datastoreKeysToClean = [
	datastore.key(["IncomingRequest", SMS_MESSAGE_SID]),
	datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
	datastore.key(["ThreeRingsCache", "volunteer-180262"]),
	datastore.key(["ThreeRingsCache", "volunteer-108235"]),
];

const MOCK_TWILIO_SIGNATURE = "test-twilio-signature";

// Variables prefixed with "mock" are hoisted by ts-jest alongside jest.mock() factories.
const mockMessagesCreate = jest.fn().mockResolvedValue({ sid: "SM_mock" });
const mockValidateRequest = jest.fn().mockReturnValue(true);
const mockGetExpectedTwilioSignature = jest
	.fn()
	.mockReturnValue("expected-signature");

jest.mock("twilio", () => {
	const twilioFn = Object.assign(
		jest.fn(() => ({
			messages: {
				create: mockMessagesCreate,
			},
		})),
		{
			validateRequest: mockValidateRequest,
			getExpectedTwilioSignature: mockGetExpectedTwilioSignature,
		},
	);
	return {
		__esModule: true,
		default: twilioFn,
	};
});

function postTwilioWebhook(
	body: Record<string, string>,
	signature = MOCK_TWILIO_SIGNATURE,
) {
	return supertest(getTestServer("receiveMessage"))
		.post("/")
		.set("X-Twilio-Signature", signature)
		.send(body);
}

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

describe("receiveMessage", () => {
	beforeAll(() => {
		require("../../src/index");
	});

	beforeEach(async () => {
		const ancestor = datastore.key(["IncomingRequest", SMS_MESSAGE_SID]);
		const [outgoing] = await datastore.runQuery(
			datastore.createQuery("OutgoingMessage").hasAncestor(ancestor),
		);
		const outgoingKeys = outgoing.flatMap((entity) => {
			const key = entity[datastore.KEY];
			return key ? [key] : [];
		});
		await datastore.delete([...datastoreKeysToClean, ...outgoingKeys]);
	});

	afterEach(() => {
		nock.cleanAll();
		mockMessagesCreate.mockClear();
		mockValidateRequest.mockClear();
		mockValidateRequest.mockReturnValue(true);
		mockGetExpectedTwilioSignature.mockClear();
		mockGetExpectedTwilioSignature.mockReturnValue("expected-signature");
	});

	it("returns 204 when Three Rings rota export succeeds", async () => {
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

		const INCOMING_BODY =
			"Event Alert: Bike Over at 01/01/2024 10:32:30 for Device KS72RRV West/Swansea Tracer -276129403. Τo confirm theft call 0800 0496679";
		const INCOMING_FROM = "+447896843243";

		await postTwilioWebhook({
			ToCountry: "GB",
			ToState: "",
			SmsMessageSid: SMS_MESSAGE_SID,
			NumMedia: "0",
			ToCity: "",
			FromZip: "",
			SmsSid: SMS_MESSAGE_SID,
			FromState: "",
			SmsStatus: "received",
			FromCity: "",
			Body: INCOMING_BODY,
			FromCountry: "GB",
			To: "+447700900999",
			ToZip: "",
			NumSegments: "2",
			MessageSid: "SM_MOCK",
			AccountSid: "AC_MOCK",
			From: INCOMING_FROM,
			ApiVersion: "2010-04-01",
		}).expect(204);

		expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
		expect(mockMessagesCreate).toHaveBeenCalledWith({
			body: INCOMING_BODY,
			from: "BBWales",
			to: "+447700900989", // duty trustee only (ENABLE_CONTROLLER_ALERTS unset)
		});

		// Verify the incoming request was logged to Datastore.
		const [incomingRequest] = await datastore.get(
			datastore.key(["IncomingRequest", SMS_MESSAGE_SID]),
		);
		expect(incomingRequest).toMatchObject({
			smsMessageSid: SMS_MESSAGE_SID,
			body: INCOMING_BODY,
			from: INCOMING_FROM,
		});
		expect(incomingRequest.expiresAt).toEqual(
			new Date("2024-01-29T10:30:53.697Z"),
		);

		const [outgoingMessages] = await datastore.runQuery(
			datastore
				.createQuery("OutgoingMessage")
				.hasAncestor(datastore.key(["IncomingRequest", SMS_MESSAGE_SID])),
		);
		expect(outgoingMessages).toHaveLength(1);
		expect(outgoingMessages[0]?.expiresAt).toEqual(
			new Date("2024-01-29T10:30:53.697Z"),
		);

		// Verify Three Rings responses were cached with a 24h TTL.
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

	it("returns 403 when the Twilio webhook signature is invalid", async () => {
		mockValidateRequest.mockReturnValue(false);

		await postTwilioWebhook(
			{
				SmsMessageSid: SMS_MESSAGE_SID,
				Body: "Event Alert",
				From: "+447896843243",
			},
			"invalid-signature",
		).expect(403);

		expect(mockMessagesCreate).not.toHaveBeenCalled();
	});

	it("uses cached Three Rings data on a repeat request", async () => {
		// Pre-populate the cache so no HTTP calls to Three Rings are needed.
		await datastore.save([
			{
				key: datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
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
			},
			{
				key: datastore.key(["ThreeRingsCache", "volunteer-180262"]),
				data: [
					{
						name: "data",
						value: JSON.stringify(controllerDirectoryFixture),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-02T10:30:53.697Z"),
					},
				],
			},
			{
				key: datastore.key(["ThreeRingsCache", "volunteer-108235"]),
				data: [
					{
						name: "data",
						value: JSON.stringify(dutyTrusteeDirectoryFixture),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-02T10:30:53.697Z"),
					},
				],
			},
		]);

		const INCOMING_BODY = "Event Alert: repeat request";
		const INCOMING_FROM = "+447896843243";

		await postTwilioWebhook({
			ToCountry: "GB",
			ToState: "",
			SmsMessageSid: SMS_MESSAGE_SID,
			NumMedia: "0",
			ToCity: "",
			FromZip: "",
			SmsSid: SMS_MESSAGE_SID,
			FromState: "",
			SmsStatus: "received",
			FromCity: "",
			Body: INCOMING_BODY,
			FromCountry: "GB",
			To: "+447700900999",
			ToZip: "",
			NumSegments: "2",
			MessageSid: "SM_MOCK",
			AccountSid: "AC_MOCK",
			From: INCOMING_FROM,
			ApiVersion: "2010-04-01",
		}).expect(204);

		// Three Rings API should not have been called.
		expect(nock.pendingMocks()).toHaveLength(0);
		expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
	});

	it("refetches Three Rings rota data when the cache TTL has expired", async () => {
		await datastore.save([
			{
				key: datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
				data: [
					{
						name: "data",
						value: JSON.stringify({ shifts: [] }),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-01T10:30:53.697Z"),
					},
				],
			},
			{
				key: datastore.key(["ThreeRingsCache", "volunteer-180262"]),
				data: [
					{
						name: "data",
						value: JSON.stringify(controllerDirectoryFixture),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-02T10:30:53.697Z"),
					},
				],
			},
			{
				key: datastore.key(["ThreeRingsCache", "volunteer-108235"]),
				data: [
					{
						name: "data",
						value: JSON.stringify(dutyTrusteeDirectoryFixture),
						excludeFromIndexes: true,
					},
					{
						name: "expiresAt",
						value: new Date("2024-01-02T10:30:53.697Z"),
					},
				],
			},
		]);

		nock("https://www.3r.org.uk")
			.get("/stats/export_rotas.json")
			.query({ start_date: MOCK_ROTA_DAY, end_date: MOCK_ROTA_DAY })
			.reply(200, rotaFixture);

		await postTwilioWebhook({
			ToCountry: "GB",
			ToState: "",
			SmsMessageSid: SMS_MESSAGE_SID,
			NumMedia: "0",
			ToCity: "",
			FromZip: "",
			SmsSid: SMS_MESSAGE_SID,
			FromState: "",
			SmsStatus: "received",
			FromCity: "",
			Body: "Event Alert: expired cache",
			FromCountry: "GB",
			To: "+447700900999",
			ToZip: "",
			NumSegments: "2",
			MessageSid: "SM_MOCK",
			AccountSid: "AC_MOCK",
			From: "+447896843243",
			ApiVersion: "2010-04-01",
		}).expect(204);

		expect(nock.pendingMocks()).toHaveLength(0);
		expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

		const [rotaCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", `rota-${MOCK_ROTA_DAY}`]),
		);
		expect(rotaCache.expiresAt).toEqual(new Date("2024-01-02T10:30:53.697Z"));
		expect(JSON.parse(rotaCache.data as string)).toEqual(rotaFixture);
	});
});
