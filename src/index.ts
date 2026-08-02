import type { Request, Response } from "@google-cloud/functions-framework";
import * as functions from "@google-cloud/functions-framework";
import twilio from "twilio";
import Config from "./config";
import { ThreeRingsCachingRepository } from "./repository/ThreeRingsCachingRepository";
import { ThreeRingsHttpRepository } from "./repository/ThreeRingsHttpRepository";
import { createRequestLogger } from "./service/logging.service";
import { MessageLogService } from "./service/message-log.service";
import { ThreeRingsService } from "./service/three-rings";
import { isValidTwilioWebhook } from "./twilio-webhook";
import type { TwilioBody } from "./types";
import { RotaType, VolunteerPropertyType } from "./types";
import Utility from "./utility";

const receiveMessage = async (req: Request, res: Response) => {
	const currentDateTime = Utility.getCurrentDate();
	const log = createRequestLogger(currentDateTime);

	log.info("Received message from Twilio");
	if (!isValidTwilioWebhook(req)) {
		log.info("Failed to verify Twilio webhook");
		return res.status(403).send("Forbidden");
	}

	const body = req.body as TwilioBody;
	const client = twilio(
		Config.getTwilioAccountSid(),
		Config.getTwilioAuthToken(),
	);

	log.info({ body: { ...body } }, "Starting to store Twilio body in datastore");
	const messageLogService = new MessageLogService();
	const requestKey = await messageLogService.logIncomingRequest(body);

	const threeRings = new ThreeRingsService(
		new ThreeRingsCachingRepository(new ThreeRingsHttpRepository()),
	);

	log.info("Getting rota from Three Rings");
	const rota = await threeRings.getRotaExportForDay(currentDateTime);

	log.info("Getting volunteer from Three Rings shift");
	const controller = threeRings.getVolunteerForShift(
		rota.shifts,
		currentDateTime,
		RotaType.CONTROLLER,
	);
	log.info({ user_id: controller.id }, "Found Controller");

	log.info("Getting duty trustee from Three Rings shift");
	const dutyTrustee = threeRings.getVolunteerForShift(
		rota.shifts,
		currentDateTime,
		RotaType.DUTY_TRUSTEE,
	);
	log.info({ user_id: dutyTrustee.id }, "Found Duty Trustee");

	const [controllerDetails, trusteeDetails] = await Promise.all([
		await threeRings.getVolunteerDetails(controller.id),
		await threeRings.getVolunteerDetails(dutyTrustee.id),
	]);

	const controllerPhoneNumber = threeRings.getVolunteerProperty(
		controllerDetails.volunteer,
		VolunteerPropertyType.TELEPHONE,
	);
	log.info("Have controller phone number");

	const dutyTrusteePhoneNumber = threeRings.getVolunteerProperty(
		trusteeDetails.volunteer,
		VolunteerPropertyType.TELEPHONE,
	);

	for (const phoneNumber of [controllerPhoneNumber, dutyTrusteePhoneNumber]) {
		await client.messages.create({
			body: body.Body,
			from: "BBWales",
			to: phoneNumber,
		});
		log.info(
			{ to: Utility.redactPhoneNumber(phoneNumber) },
			"Sent message to volunteer",
		);
		await messageLogService.logOutgoingMessage(
			requestKey,
			phoneNumber,
			body.From,
			body.Body,
		);
	}

	log.info("Completed function");

	return res.status(204).send({});
};

functions.http("receiveMessage", receiveMessage);

export { receiveMessage };
