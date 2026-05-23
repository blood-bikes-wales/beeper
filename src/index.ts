import type { Request, Response } from "@google-cloud/functions-framework";
import * as functions from "@google-cloud/functions-framework";

import twilio from "twilio";
import Config from "./config";
import { ThreeRingsHttpRepository } from "./repository/ThreeRingsHttpRepository";
import { ThreeRingsService } from "./service/three-rings";
import { RotaType, VolunteerPropertyType } from "./types";
import type { TwilioBody } from "./types/RequestBody.type";
import Utility from "./utility";

const receiveMessage = async (req: Request, res: Response) => {
	const body = req.body as TwilioBody;
	const client = twilio(
		Config.getTwilioAccountSid(),
		Config.getTwilioAuthToken(),
	);

	const threeRings = new ThreeRingsService(new ThreeRingsHttpRepository());
	const currentDateTime = Utility.getCurrentDate();

	const rota = await threeRings.getRotaExportForDay(currentDateTime);

	const controller = threeRings.getVolunteerForShift(
		rota.shifts,
		currentDateTime,
		RotaType.CONTROLLER,
	);
	const dutyTrustee = threeRings.getVolunteerForShift(
		rota.shifts,
		currentDateTime,
		RotaType.DUTY_TRUSTEE,
	);

	const [controllerDetails, trusteeDetails] = await Promise.all([
		await threeRings.getVolunteerDetails(controller.id),
		await threeRings.getVolunteerDetails(dutyTrustee.id),
	]);

	const controllerPhoneNumber = threeRings.getVolunteerProperty(
		controllerDetails.volunteer,
		VolunteerPropertyType.TELEPHONE,
	);
	const dutyTrusteePhoneNumber = threeRings.getVolunteerProperty(
		trusteeDetails.volunteer,
		VolunteerPropertyType.TELEPHONE,
	);

	for (const phoneNumber of [controllerPhoneNumber, dutyTrusteePhoneNumber]) {
		await client.messages.create({
			body: body.Body,
			from: body.From,
			to: phoneNumber,
		});
	}

	return res.status(204).send({});
};

functions.http("receiveMessage", receiveMessage);

export { receiveMessage };
