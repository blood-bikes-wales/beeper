const capturedLines: string[] = [];

jest.mock("pino", () => {
	const { Writable } = require("node:stream");
	const actual = jest.requireActual<typeof import("pino")>("pino");
	const testDestination = new Writable({
		write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) {
			capturedLines.push(chunk.toString());
			callback();
		},
	});

	const pinoMock = Object.assign(
		(...args: Parameters<typeof actual.default>) => actual.default(...args),
		{
			destination: jest.fn(() => testDestination),
		},
	);

	return { __esModule: true, default: pinoMock };
});

import pino from "pino";
import {
	default as baseLogger,
	createLogger,
	createRequestLogger,
} from "../../src/service/logging.service";

describe("logging.service", () => {
	beforeEach(() => {
		capturedLines.length = 0;
	});

	function parseLastLogLine(): Record<string, unknown> {
		const line = capturedLines.at(-1);
		if (!line) {
			throw new Error("Expected a captured log line");
		}

		return JSON.parse(line) as Record<string, unknown>;
	}

	it("configures pino to use stdout as the log destination", () => {
		expect(pino.destination).toHaveBeenCalledWith({ dest: 1, sync: false });
	});

	it("writes base logs with app_name", () => {
		baseLogger.info("hello from base logger");

		expect(parseLastLogLine()).toMatchObject({
			app_name: "Beeper",
			msg: "hello from base logger",
			level: 30,
		});
	});

	it("writes request logs with app_name and current_time", () => {
		const log = createRequestLogger("2024-01-01T10:00:00.000Z");
		log.info("hello from request logger");

		expect(parseLastLogLine()).toMatchObject({
			app_name: "Beeper",
			current_time: "2024-01-01T10:00:00.000Z",
			msg: "hello from request logger",
			level: 30,
		});
	});

	it("returns the shared base logger when createLogger is called without options", () => {
		expect(createLogger()).toBe(baseLogger);
	});

	it("creates a custom logger that still includes app_name", () => {
		const log = createLogger({
			level: "warn",
		});

		log.warn("custom logger message");

		expect(parseLastLogLine()).toMatchObject({
			app_name: "Beeper",
			msg: "custom logger message",
			level: 40,
		});
	});
});
