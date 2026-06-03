import { getTestServer } from "@google-cloud/functions-framework/testing";
import nock from "nock";
import supertest from "supertest";
import { datastore } from "../../src/datastore";
import dutyTrusteeDirectoryFixture from "../fixtures/directory-search-108235-export.json";
import controllerDirectoryFixture from "../fixtures/directory-search-180262-export.json";
import rotaFixture from "../fixtures/rota-export.json";

const MOCK_CURRENT_DATE = "2024-01-01T10:30:53.697Z";
const SMS_MESSAGE_SID = "SM7068ddb127c539915189_test";

// Datastore keys touched during each test run.
const datastoreKeysToClean = [
	datastore.key(["IncomingRequest", SMS_MESSAGE_SID]),
	datastore.key(["ThreeRingsCache", `rota-${MOCK_CURRENT_DATE}`]),
	datastore.key(["ThreeRingsCache", "volunteer-180262"]),
	datastore.key(["ThreeRingsCache", "volunteer-108235"]),
];

// Variables prefixed with "mock" are hoisted by ts-jest alongside jest.mock() factories.
const mockMessagesCreate = jest.fn().mockResolvedValue({ sid: "SM_mock" });

jest.mock("twilio", () => ({
	__esModule: true,
	default: jest.fn(() => ({
		messages: {
			create: mockMessagesCreate,
		},
	})),
}));

jest.mock("../../src/utility", () => ({
	__esModule: true,
	default: {
		getCurrentDate: jest.fn(() => MOCK_CURRENT_DATE),
	},
}));

describe("receiveMessage", () => {
	beforeAll(() => {
		require("../../src/index");
	});

	beforeEach(async () => {
		await datastore.delete(datastoreKeysToClean);
	});

	afterEach(() => {
		nock.cleanAll();
		mockMessagesCreate.mockClear();
	});

	it("returns 204 when Three Rings rota export succeeds", async () => {
		nock("https://www.3r.org.uk")
			.get("/stats/export_rotas.json")
			.query({ start_date: MOCK_CURRENT_DATE, end_date: MOCK_CURRENT_DATE })
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

		await supertest(getTestServer("receiveMessage"))
			.post("/")
			.send({
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
			})
			.expect(204);

		expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
		expect(mockMessagesCreate).toHaveBeenNthCalledWith(1, {
			body: INCOMING_BODY,
			from: INCOMING_FROM,
			to: "07700900999", // controller (fixture: directory-search-180262)
		});
		expect(mockMessagesCreate).toHaveBeenNthCalledWith(2, {
			body: INCOMING_BODY,
			from: INCOMING_FROM,
			to: "07700900989", // duty trustee (fixture: directory-search-108235)
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

		// Verify Three Rings responses were cached.
		const [rotaCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", `rota-${MOCK_CURRENT_DATE}`]),
		);
		expect(rotaCache).toBeDefined();

		const [controllerCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", "volunteer-180262"]),
		);
		expect(controllerCache).toBeDefined();

		const [trusteeCache] = await datastore.get(
			datastore.key(["ThreeRingsCache", "volunteer-108235"]),
		);
		expect(trusteeCache).toBeDefined();
	});

	it("uses cached Three Rings data on a repeat request", async () => {
		// Pre-populate the cache so no HTTP calls to Three Rings are needed.
		await datastore.save([
			{
				key: datastore.key(["ThreeRingsCache", `rota-${MOCK_CURRENT_DATE}`]),
				data: [
					{
						name: "data",
						value: JSON.stringify(rotaFixture),
						excludeFromIndexes: true,
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
				],
			},
		]);

		const INCOMING_BODY = "Event Alert: repeat request";
		const INCOMING_FROM = "+447896843243";

		await supertest(getTestServer("receiveMessage"))
			.post("/")
			.send({
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
			})
			.expect(204);

		// Three Rings API should not have been called.
		expect(nock.pendingMocks()).toHaveLength(0);
		expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
	});
});
