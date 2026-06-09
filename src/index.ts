import type { Request, Response } from "@google-cloud/functions-framework";
import * as functions from "@google-cloud/functions-framework";

import twilio from "twilio";
import Config from "./config";
import { ThreeRingsCachingRepository } from "./repository/ThreeRingsCachingRepository";
import { ThreeRingsHttpRepository } from "./repository/ThreeRingsHttpRepository";
import { MessageLogService } from "./service/message-log.service";
import { ThreeRingsService } from "./service/three-rings";
import { isValidTwilioWebhook } from "./twilio-webhook";
import { RotaType, VolunteerPropertyType } from "./types";
import type { TwilioBody } from "./types/RequestBody.type";
import Utility from "./utility";

const receiveMessage = async (req: Request, res: Response) => {
	if (!isValidTwilioWebhook(req)) {
		return res.status(403).send("Forbidden");
	}

	const body = req.body as TwilioBody;
	const client = twilio(
		Config.getTwilioAccountSid(),
		Config.getTwilioAuthToken(),
	);

	const messageLogService = new MessageLogService();
	const requestKey = await messageLogService.logIncomingRequest(body);

	const threeRings = new ThreeRingsService(
		new ThreeRingsCachingRepository(new ThreeRingsHttpRepository()),
	);
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
		await messageLogService.logOutgoingMessage(
			requestKey,
			phoneNumber,
			body.From,
			body.Body,
		);
	}

	return res.status(204).send({});
};

functions.http("receiveMessage", receiveMessage);

export { receiveMessage };
