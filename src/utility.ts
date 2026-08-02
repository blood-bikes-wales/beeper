import { DateTime } from "luxon";

// biome-ignore lint/complexity/noStaticOnlyClass: <we dont need an instance yet>
export default class Utility {
	static getCurrentDate(): string {
		return DateTime.now().toString();
	}

	static redactPhoneNumber(phoneNumber: string): string {
		const digits = phoneNumber.replace(/\D/g, "");
		return `****${digits.slice(-4)}`;
	}

	static formatPhoneNumber(phoneNumber: string): string {
		if (phoneNumber.startsWith("07")) {
			return `+44${phoneNumber.slice(1)}`;
		}
		return phoneNumber;
	}
}
