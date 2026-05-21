// biome-ignore lint/complexity/noStaticOnlyClass: <we dont need an instance yet>
export default class Utility {
	static getCurrentDate(): string {
		const date = new Date("2019-02-19T06:00:00Z").toLocaleDateString("en-gb", {
			year: "2-digit",
			month: "2-digit",
			day: "2-digit",
		});

		console.log("date", date);

		return date.toString();
	}
}
