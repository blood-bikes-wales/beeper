import type { Request, Response } from "@google-cloud/functions-framework";

import { ThreeRings } from "./service/three-rings";
import Utility from "./utility";

exports.receiveMessage = async (_: Request, res: Response) => {
	const threeRings = new ThreeRings();
	const rota = await threeRings.getRotaExportForDay(Utility.getCurrentDate());
	threeRings.getControllerFromRota(rota.data.shifts);

	return res.status(204).send({});
};
