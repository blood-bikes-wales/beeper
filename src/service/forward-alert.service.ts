import type { Key } from "@google-cloud/datastore";
import twilio from "twilio";
import Config from "../config";
import { ThreeRingsCachingRepository } from "../repository/ThreeRingsCachingRepository";
import { ThreeRingsHttpRepository } from "../repository/ThreeRingsHttpRepository";
import { RotaType, VolunteerPropertyType } from "../types";
import type { IncomingAlert } from "../types/IncomingAlert.type";
import Utility from "../utility";
import type { Logger } from "./logging.service";
import { MessageLogService } from "./message-log.service";
import { ThreeRingsService } from "./three-rings";

export async function forwardAlert(
	alert: IncomingAlert,
	log: Logger,
): Promise<void> {
	const messageLog = new MessageLogService();
	const alreadyLogged = await messageLog.hasIncomingRequest(alert.id);
	if (alreadyLogged) {
		log.info({ messageId: alert.id }, "Skipping alert already forwarded");
		return;
	}

	const requestKey = await messageLog.logIncomingRequest(alert);
	try {
		await sendToOnCall(alert, requestKey, log);
	} catch (error) {
		await messageLog.deleteIncomingRequest(alert.id);
		throw error;
	}
}

async function sendToOnCall(
	alert: IncomingAlert,
	requestKey: Key,
	log: Logger,
): Promise<void> {
	const currentDateTime = Utility.getCurrentDate();
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
		threeRings.getVolunteerDetails(controller.id),
		threeRings.getVolunteerDetails(dutyTrustee.id),
	]);

	const controllerPhoneNumber = threeRings.getVolunteerProperty(
		controllerDetails.volunteer,
		VolunteerPropertyType.TELEPHONE,
	);
	const dutyTrusteePhoneNumber = threeRings.getVolunteerProperty(
		trusteeDetails.volunteer,
		VolunteerPropertyType.TELEPHONE,
	);
	const phoneNumbers = onCallNumbers(
		controllerPhoneNumber,
		dutyTrusteePhoneNumber,
	);
	const client = twilio(
		Config.getTwilioAccountSid(),
		Config.getTwilioAuthToken(),
	);
	const messageLog = new MessageLogService();

	for (const phoneNumber of phoneNumbers) {
		await sendSms(client, messageLog, requestKey, phoneNumber, alert, log);
	}
}

function onCallNumbers(
	controllerPhoneNumber: string,
	dutyTrusteePhoneNumber: string,
): string[] {
	if (!Config.getEnableControllerAlerts()) {
		return [dutyTrusteePhoneNumber];
	}

	return [controllerPhoneNumber, dutyTrusteePhoneNumber];
}

async function sendSms(
	client: ReturnType<typeof twilio>,
	messageLog: MessageLogService,
	requestKey: Key,
	phoneNumber: string,
	alert: IncomingAlert,
	log: Logger,
): Promise<void> {
	await client.messages.create({
		body: alert.body,
		from: "BBWales",
		to: phoneNumber,
	});
	log.info(
		{ to: Utility.redactPhoneNumber(phoneNumber) },
		"Sent message to volunteer",
	);
	await messageLog.logOutgoingMessage(
		requestKey,
		phoneNumber,
		alert.from,
		alert.body,
	);
}
