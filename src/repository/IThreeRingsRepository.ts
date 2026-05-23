import type { RotaResponseType, VolunteerResponseType } from "../types";

export interface IThreeRingsRepository {
	getRotaExportForDay(date: string): Promise<RotaResponseType>;
	getVolunteerDetails(volunteerId: number): Promise<VolunteerResponseType>;
}
