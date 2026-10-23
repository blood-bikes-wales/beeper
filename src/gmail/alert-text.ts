const EVENT_START = "A new Event has been created";
const FOOTER =
	/^(?:View Map|To confirm theft call|This is an automated email)/m;
const LINK = /\s*<https?:\/\/[^>]*>\s*/g;

export type ExtractedAlertText = {
	body: string;
	matched: boolean;
};

export function extractAlertText(text: string): ExtractedAlertText {
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const start = normalized.indexOf(EVENT_START);
	if (start === -1) {
		return { body: cleanAlertText(normalized), matched: false };
	}

	return {
		body: cleanAlertText(beforeFooter(normalized.slice(start))),
		matched: true,
	};
}

function beforeFooter(text: string): string {
	const footer = text.search(FOOTER);
	if (footer === -1) {
		return text;
	}

	return text.slice(0, footer);
}

function linkReplacement(match: string): string {
	if (match.includes("\n")) {
		return "";
	}

	return " ";
}

function cleanAlertText(text: string): string {
	const withoutLinks = text.replace(LINK, linkReplacement);
	const trimmedLines = withoutLinks
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
	return trimmedLines.replace(/\n{3,}/g, "\n\n").trim();
}
