import { DateTime } from "luxon";
import { datastore } from "../datastore";
import type { RotaResponseType, VolunteerResponseType } from "../types";
import Utility from "../utility";
import type { IThreeRingsRepository } from "./IThreeRingsRepository";

const THREE_RINGS_CACHE_TTL_HOURS = 24;

export class ThreeRingsCachingRepository implements IThreeRingsRepository {
	constructor(private readonly inner: IThreeRingsRepository) {}

	async getRotaExportForDay(date: string): Promise<RotaResponseType> {
		const day = DateTime.fromISO(date).toISODate() ?? date;
		return this.cached(`rota-${day}`, () =>
			this.inner.getRotaExportForDay(day),
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

		if (entity && !this.isExpired(entity)) {
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
				{
					name: "expiresAt",
					value: DateTime.fromISO(Utility.getCurrentDate())
						.plus({ hours: THREE_RINGS_CACHE_TTL_HOURS })
						.toJSDate(),
				},
			],
		});
		return fresh;
	}

	private isExpired(entity: { expiresAt?: Date | string }): boolean {
		if (!entity.expiresAt) {
			return true;
		}

		const expiresAt =
			entity.expiresAt instanceof Date
				? DateTime.fromJSDate(entity.expiresAt)
				: DateTime.fromISO(String(entity.expiresAt));
		const now = DateTime.fromISO(Utility.getCurrentDate());
		return !expiresAt.isValid || expiresAt <= now;
	}
}
