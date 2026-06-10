import type { IThreeRingsRepository } from "../../src/repository/IThreeRingsRepository";
import { ThreeRingsService } from "../../src/service/three-rings";
import type { Shift, VolunteerType } from "../../src/types";
import { RotaType, VolunteerPropertyType } from "../../src/types";

// Neither method under test touches the repository, so a bare cast is fine.
const service = new ThreeRingsService({} as IThreeRingsRepository);

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildVolunteer(id: number) {
	return { id, name: `Volunteer ${id}` };
}

function buildShift(overrides: Partial<Shift> = {}): Shift {
	return {
		id: 1,
		rota: RotaType.CONTROLLER,
		title: "Controller shift",
		start_datetime: "2024-01-01T09:00:00.000Z",
		duration: 3600, // 1 hour → ends at 10:00:00Z
		volunteers: [buildVolunteer(1)],
		...overrides,
	};
}

function buildVolunteerType(
	name: string,
	properties: Partial<VolunteerType["volunteer_properties"][number]>[] = [],
): VolunteerType {
	return {
		name,
		volunteer_properties: properties.map((p, i) => ({
			id: i + 1,
			code: "telephone_mobile",
			name: "Telephone (Mobile)",
			type: VolunteerPropertyType.TELEPHONE,
			value: "07700900000",
			...p,
		})),
	};
}

// ---------------------------------------------------------------------------
// getVolunteerProperty
// ---------------------------------------------------------------------------

describe("ThreeRingsService.getVolunteerProperty", () => {
	it("returns the value of the matching property type", () => {
		const volunteer = buildVolunteerType("Dana Thompson", [
			{ type: VolunteerPropertyType.TELEPHONE, value: "07700900999" },
		]);

		const result = service.getVolunteerProperty(
			volunteer,
			VolunteerPropertyType.TELEPHONE,
		);

		expect(result).toBe("07700900999");
	});

	it("returns the correct property when the volunteer has multiple property types", () => {
		const volunteer = buildVolunteerType("Dana Thompson", [
			{ type: VolunteerPropertyType.STRING, value: "Dana", code: "first_name" },
			{ type: VolunteerPropertyType.EMAIL, value: "dana@example.com" },
			{ type: VolunteerPropertyType.TELEPHONE, value: "07700900999" },
		]);

		const result = service.getVolunteerProperty(
			volunteer,
			VolunteerPropertyType.TELEPHONE,
		);

		expect(result).toBe("07700900999");
	});

	it("throws when the requested property type is not present", () => {
		const volunteer = buildVolunteerType("Dana Thompson", [
			{ type: VolunteerPropertyType.STRING, value: "Dana" },
		]);

		expect(() =>
			service.getVolunteerProperty(volunteer, VolunteerPropertyType.TELEPHONE),
		).toThrow(
			`No ${VolunteerPropertyType.TELEPHONE} found for volunteer: Dana Thompson`,
		);
	});

	it("throws when the volunteer has no properties at all", () => {
		const volunteer = buildVolunteerType("Dana Thompson", []);

		expect(() =>
			service.getVolunteerProperty(volunteer, VolunteerPropertyType.TELEPHONE),
		).toThrow(
			`No ${VolunteerPropertyType.TELEPHONE} found for volunteer: Dana Thompson`,
		);
	});
});

// ---------------------------------------------------------------------------
// getVolunteerForShift
// ---------------------------------------------------------------------------

describe("ThreeRingsService.getVolunteerForShift", () => {
	// Shift: 09:00:00Z – 10:00:00Z (duration 3600s)

	it("returns the volunteer for a shift that contains the current time", () => {
		const volunteer = buildVolunteer(42);
		const shift = buildShift({ volunteers: [volunteer] });

		const result = service.getVolunteerForShift(
			[shift],
			"2024-01-01T09:30:00.000Z",
			RotaType.CONTROLLER,
		);

		expect(result).toEqual(volunteer);
	});

	it("matches when the current time is exactly at the shift start (inclusive)", () => {
		const volunteer = buildVolunteer(42);
		const shift = buildShift({ volunteers: [volunteer] });

		const result = service.getVolunteerForShift(
			[shift],
			"2024-01-01T09:00:00.000Z",
			RotaType.CONTROLLER,
		);

		expect(result).toEqual(volunteer);
	});

	it("does not match when the current time is exactly at the shift end (exclusive)", () => {
		const shift = buildShift();

		expect(() =>
			service.getVolunteerForShift(
				[shift],
				"2024-01-01T10:00:00.000Z",
				RotaType.CONTROLLER,
			),
		).toThrow();
	});

	it("throws when no shift matches the current time", () => {
		const shift = buildShift();

		expect(() =>
			service.getVolunteerForShift(
				[shift],
				"2024-01-01T11:00:00.000Z", // after the shift ends
				RotaType.CONTROLLER,
			),
		).toThrow(
			`We did not get exactly one 'Controller' shift found for the current date: 2024-01-01T11:00:00.000Z, recieved: 0`,
		);
	});

	it("throws when no shift matches the requested rota type", () => {
		const shift = buildShift({ rota: RotaType.CONTROLLER });

		expect(() =>
			service.getVolunteerForShift(
				[shift],
				"2024-01-01T09:30:00.000Z",
				RotaType.DUTY_TRUSTEE,
			),
		).toThrow(
			`We did not get exactly one 'Duty Trustee' shift found for the current date: 2024-01-01T09:30:00.000Z, recieved: 0`,
		);
	});

	it("throws when more than one shift matches", () => {
		const shifts = [buildShift({ id: 1 }), buildShift({ id: 2 })];

		expect(() =>
			service.getVolunteerForShift(
				shifts,
				"2024-01-01T09:30:00.000Z",
				RotaType.CONTROLLER,
			),
		).toThrow(
			`We did not get exactly one 'Controller' shift found for the current date: 2024-01-01T09:30:00.000Z, recieved: 2`,
		);
	});

	it("throws when the matching shift has no volunteers", () => {
		const shift = buildShift({ volunteers: [] });

		expect(() =>
			service.getVolunteerForShift(
				[shift],
				"2024-01-01T09:30:00.000Z",
				RotaType.CONTROLLER,
			),
		).toThrow(
			`0 volunteers found for the 'Controller' shift on the current date`,
		);
	});

	it("throws when the matching shift has more than one volunteer", () => {
		const shift = buildShift({
			volunteers: [buildVolunteer(1), buildVolunteer(2)],
		});

		expect(() =>
			service.getVolunteerForShift(
				[shift],
				"2024-01-01T09:30:00.000Z",
				RotaType.CONTROLLER,
			),
		).toThrow(
			`2 volunteers found for the 'Controller' shift on the current date`,
		);
	});

	it("ignores shifts of a different rota type when finding the correct volunteer", () => {
		const controllerVolunteer = buildVolunteer(1);
		const controllerShift = buildShift({
			rota: RotaType.CONTROLLER,
			volunteers: [controllerVolunteer],
		});
		const dutyTrusteeShift = buildShift({
			id: 2,
			rota: RotaType.DUTY_TRUSTEE,
			volunteers: [buildVolunteer(2)],
		});

		const result = service.getVolunteerForShift(
			[controllerShift, dutyTrusteeShift],
			"2024-01-01T09:30:00.000Z",
			RotaType.CONTROLLER,
		);

		expect(result).toEqual(controllerVolunteer);
	});
});
