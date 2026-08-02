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

describe("Utility.formatPhoneNumber", () => {
	it("converts a UK mobile starting with 07 to E.164", () => {
		expect(Utility.formatPhoneNumber("07700900989")).toBe("+447700900989");
	});

	it("leaves an E.164 number unchanged", () => {
		expect(Utility.formatPhoneNumber("+447700900989")).toBe("+447700900989");
	});

	it("leaves a non-07 national number unchanged", () => {
		expect(Utility.formatPhoneNumber("01234567890")).toBe("01234567890");
	});
});
