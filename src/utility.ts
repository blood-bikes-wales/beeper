import { DateTime } from "luxon";

// biome-ignore lint/complexity/noStaticOnlyClass: <we dont need an instance yet>
export default class Utility {
	static getCurrentDate(): string {
		return DateTime.now().toString();
	}
}
