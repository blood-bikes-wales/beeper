import type { Request, Response } from "@google-cloud/functions-framework";
import * as functions from "@google-cloud/functions-framework";
import { ThreeRingsCachingRepository } from "../repository/ThreeRingsCachingRepository";
import { ThreeRingsHttpRepository } from "../repository/ThreeRingsHttpRepository";
import { createRequestLogger } from "../service/logging.service";
import { ThreeRingsService } from "../service/three-rings";
import Utility from "../utility";

export const threeRingsHotCache = async (_: Request, res: Response) => {
	const currentDateTime = Utility.getCurrentDate();
	const log = createRequestLogger(currentDateTime);

	log.info("Getting rota from Three Rings");

	const threeRings = new ThreeRingsService(
		new ThreeRingsCachingRepository(new ThreeRingsHttpRepository()),
	);

	await threeRings.getRotaExportForDay(currentDateTime);

	log.info("Saving rota to cache");

	return res.status(204).send({});
};

functions.http("threeRingsHotCache", threeRingsHotCache);
