import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import Config from "../config";
import {
	type DirectoryResponseType,
	type RotaResponseType,
	RotaType,
	type Shift,
} from "../types";

export class ThreeRings {
	private readonly httpClient: AxiosInstance;
	constructor() {
		this.httpClient = axios.create({
			baseURL: "https://www.3r.org.uk/",
			headers: {
				Authorization: `APIKEY ${Config.getThreeRingsApiKey()}`,
			},
		});
	}

	async getRotaExportForDay(
		date: string,
	): Promise<AxiosResponse<RotaResponseType>> {
		return await this.httpClient.get<RotaResponseType>(
			`/stats/export_rotas.json?start_date=${date}&end_date=${date}`,
		);
	}

	async getUserDirectory(): Promise<AxiosResponse<DirectoryResponseType>> {
		return await this.httpClient.get<DirectoryResponseType>("/directory.json");
	}

	getControllerFromRota(shifts: Shift[]): void {
		shifts.filter((shift: Shift) => shift.rota === RotaType.CONTROLLER);
	}
}
