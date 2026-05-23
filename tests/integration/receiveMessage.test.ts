import { getTestServer } from "@google-cloud/functions-framework/testing";
import nock from "nock";
import supertest from "supertest";
import dutyTrusteeDirectoryFixture from "../fixtures/directory-search-108235-export.json";
import controllerDirectoryFixture from "../fixtures/directory-search-180262-export.json";
import rotaFixture from "../fixtures/rota-export.json";

const MOCK_CURRENT_DATE = "2024-01-01T10:30:53.697Z";

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

		await supertest(getTestServer("receiveMessage"))
			.post("/")
			.send({
				ToCountry: "GB",
				ToState: "",
				SmsMessageSid: "SM7068ddb127c539915189_test",
				NumMedia: "0",
				ToCity: "",
				FromZip: "",
				SmsSid: "SM7068ddb127c539915189_test",
				FromState: "",
				SmsStatus: "received",
				FromCity: "",
				Body: "Event Alert: Bike Over at 01/01/2024 10:32:30 for Device KS72RRV West/Swansea Tracer -276129403. Τo confirm theft call 0800 0496679",
				FromCountry: "GB",
				To: "+447700900999",
				ToZip: "",
				NumSegments: "2",
				MessageSid: "SM_MOCK",
				AccountSid: "AC_MOCK",
				From: "+447896843243",
				ApiVersion: "2010-04-01",
			})
			.expect(204);
	});
});
