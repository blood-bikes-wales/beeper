import { datastore } from "../datastore";
import type { RotaResponseType, VolunteerResponseType } from "../types";
import type { IThreeRingsRepository } from "./IThreeRingsRepository";

export class ThreeRingsCachingRepository implements IThreeRingsRepository {
	constructor(private readonly inner: IThreeRingsRepository) {}

	async getRotaExportForDay(date: string): Promise<RotaResponseType> {
		return this.cached(`rota-${date}`, () =>
			this.inner.getRotaExportForDay(date),
		);
	}

	async getVolunteerDetails(
		volunteerId: number,
	): Promise<VolunteerResponseType> {
		return this.cached(`volunteer-${volunteerId}`, () =>
			this.inner.getVolunteerDetails(volunteerId),
		);
	}

	private async cached<T>(
		cacheKey: string,
		fetch: () => Promise<T>,
	): Promise<T> {
		const key = datastore.key(["ThreeRingsCache", cacheKey]);
		const [entity] = await datastore.get(key);

		if (entity) {
			return JSON.parse(entity.data as string) as T;
		}

		const fresh = await fetch();
		await datastore.save({
			key,
			data: [
				{
					name: "data",
					value: JSON.stringify(fresh),
					excludeFromIndexes: true,
				},
			],
		});
		return fresh;
	}
}
