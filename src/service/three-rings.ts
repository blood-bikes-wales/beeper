import { DateTime, Interval } from "luxon";
import type { IThreeRingsRepository } from "../repository/IThreeRingsRepository";
import type {
	RotaType,
	Shift,
	VolunteerProperty,
	VolunteerPropertyType,
	VolunteerResponseType,
	VolunteerType,
} from "../types";
import type { Volunteer } from "../types/RotaResponse.type";

export class ThreeRingsService {
	constructor(private readonly repository: IThreeRingsRepository) {}

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

		return property.value;
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
				`More than one '${rotaType}' shift found for the current date: ${currentDateTime}`,
			);
		}

		if (matching[0]?.volunteers.length !== 1) {
			throw new Error(
				`More than one volunteer found for the '${rotaType}' shift on the current date: ${currentDateTime}`,
			);
		}

		return matching[0].volunteers[0] as Volunteer;
	}
}
