import pino, { type Logger, type LoggerOptions } from "pino";

const APP_NAME = "Beeper";
const logDestination = pino.destination({ dest: 1, sync: false });

const baseOptions: LoggerOptions = {
	mixin() {
		return { app_name: APP_NAME };
	},
};

const baseLogger = pino(baseOptions, logDestination);

export function createLogger(options?: LoggerOptions): Logger {
	if (!options) {
		return baseLogger;
	}

	return pino({ ...baseOptions, ...options }, logDestination);
}

export function createRequestLogger(currentDateTime: string): Logger {
	return createLogger({
		mixin() {
			return { app_name: APP_NAME, current_time: currentDateTime };
		},
	});
}

export type { Logger };
export default baseLogger;
