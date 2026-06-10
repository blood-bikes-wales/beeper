import pino, { type Logger, type LoggerOptions } from "pino";

const APP_NAME = "Beeper";

const baseOptions: LoggerOptions = {
	mixin() {
		return { app_name: APP_NAME };
	},
};

const baseLogger = pino(baseOptions);

export function createLogger(options?: LoggerOptions): Logger {
	if (!options) {
		return baseLogger;
	}

	return pino({ ...baseOptions, ...options });
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
