import Utility from "../../src/utility";

describe("Utility.redactPhoneNumber", () => {
	it("redacts a UK mobile number to the last four digits", () => {
		expect(Utility.redactPhoneNumber("07700900999")).toBe("****0999");
	});

	it("redacts an E.164 number to the last four digits", () => {
		expect(Utility.redactPhoneNumber("+447700900999")).toBe("****0999");
	});

	it("strips formatting characters before redacting", () => {
		expect(Utility.redactPhoneNumber("+44 (770) 900-0989")).toBe("****0989");
	});

	it("returns only available digits when fewer than four are present", () => {
		expect(Utility.redactPhoneNumber("123")).toBe("****123");
	});
});
