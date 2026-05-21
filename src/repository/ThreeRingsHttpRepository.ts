import axios, { type AxiosInstance } from "axios";
import Config from "../config";
import type { RotaResponseType, VolunteerResponseType } from "../types";
import type { IThreeRingsRepository } from "./IThreeRingsRepository";

export class ThreeRingsHttpRepository implements IThreeRingsRepository {
	private readonly httpClient: AxiosInstance;

	constructor() {
		this.httpClient = axios.create({
			baseURL: "https://www.3r.org.uk/",
			headers: {
				Authorization: `APIKEY ${Config.getThreeRingsApiKey()}`,
			},
		});
	}

	async getRotaExportForDay(date: string): Promise<RotaResponseType> {
		const response = await this.httpClient.get<RotaResponseType>(
			`/stats/export_rotas.json?start_date=${date}&end_date=${date}`,
		);
		return response.data;
	}

	async getVolunteerDetails(
		volunteerId: number,
	): Promise<VolunteerResponseType> {
		const response = await this.httpClient.get<VolunteerResponseType>(
			`/directory/${volunteerId}?format=json`,
		);
		return response.data;
	}
}
