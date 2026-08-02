import { DateTime, Interval } from "luxon";
import type { IThreeRingsRepository } from "../repository/IThreeRingsRepository";
import {
	type RotaType,
	type Shift,
	type VolunteerProperty,
	VolunteerPropertyType,
	type VolunteerResponseType,
	type VolunteerType,
} from "../types";
import type { Volunteer } from "../types/RotaResponse.type";
import Utility from "../utility";

export class ThreeRingsService {
	constructor(private readonly repository: IThreeRingsRepository) {}

	private validateProperty(
		propertyType: VolunteerPropertyType,
		value: string,
	): string {
		switch (propertyType) {
			case VolunteerPropertyType.TELEPHONE:
				return Utility.formatPhoneNumber(value);
			default:
				return value;
		}
	}

	async getRotaExportForDay(date: string) {
		return this.repository.getRotaExportForDay(date);
	}

	async getVolunteerDetails(
		volunteerId: number,
	): Promise<VolunteerResponseType> {
		return this.repository.getVolunteerDetails(volunteerId);
	}

	getVolunteerProperty(
		volunteerDetails: VolunteerType,
		propertyType: VolunteerPropertyType,
	): string {
		const property = volunteerDetails.volunteer_properties.find(
			(property: VolunteerProperty) => {
				return property.type === propertyType;
			},
		);

		if (!property) {
			throw new Error(
				`No ${propertyType} found for volunteer: ${volunteerDetails.name}`,
			);
		}

		return this.validateProperty(propertyType, property.value);
	}

	getVolunteerForShift(
		shifts: Shift[],
		currentDateTime: string,
		rotaType: RotaType,
	): Volunteer {
		const now = DateTime.fromISO(currentDateTime);

		const matching = shifts.filter((shift: Shift) => {
			const shiftStart = DateTime.fromISO(shift.start_datetime as string);
			const shiftEnd = shiftStart.plus({ seconds: shift.duration });
			const isDuringShift = Interval.fromDateTimes(
				shiftStart,
				shiftEnd,
			).contains(now);

			return isDuringShift && shift.rota === rotaType;
		});

		if (matching.length !== 1) {
			throw new Error(
				`We did not get exactly one '${rotaType}' shift found for the current date: ${currentDateTime}, recieved: ${matching.length}`,
			);
		}

		if (matching[0]?.volunteers.length !== 1) {
			throw new Error(
				`${matching[0]?.volunteers.length} volunteers found for the '${rotaType}' shift on the current date: ${currentDateTime}`,
			);
		}

		return matching[0].volunteers[0] as Volunteer;
	}
}
