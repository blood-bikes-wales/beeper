import { extractAlertText } from "../../src/gmail/alert-text";

const SENDGRID_LINK = "<https://u2024964.ct.sendgrid.net/ls/click?upn=example>";
const MAPS_LINK =
	"<https://www.google.com/maps/search/50+Sway+Rd,+Morriston,+Swansea+SA6+6JA,+UK?entry=gmail&source=g>";

const EXAMPLE_ONE = `Movement
A new Event has been created for Device KV25DZO NW Tracer - 276125737 at
20/10/2026 13:45:02

The event type is: Movement

The location of the event is Dairy Cottage, Bangor LL57 4BP, UK.

View Map
${SENDGRID_LINK}

To confirm theft call +448000496679.
This is an automated email.`;

const EXAMPLE_ONE_SMS = `A new Event has been created for Device KV25DZO NW Tracer - 276125737 at
20/10/2026 13:45:02

The event type is: Movement

The location of the event is Dairy Cottage, Bangor LL57 4BP, UK.`;

const EXAMPLE_TWO = `Movement
A new Event has been created for Device CK24KMO NT 1100 West - 276129356 at
19/10/2026 15:24:34

The event type is: Movement

The location of the event is 50 Sway Rd, Morriston, Swansea SA6 6JA, UK
${MAPS_LINK}
.

View Map
${SENDGRID_LINK}

To confirm theft call +448000496679.
This is an automated email.`;

const EXAMPLE_TWO_SMS = `A new Event has been created for Device CK24KMO NT 1100 West - 276129356 at
19/10/2026 15:24:34

The event type is: Movement

The location of the event is 50 Sway Rd, Morriston, Swansea SA6 6JA, UK.`;

describe("BikeTrac alert text", () => {
	it("keeps the event description and drops the heading, map link, and footer", () => {
		expect(extractAlertText(EXAMPLE_ONE)).toEqual({
			body: EXAMPLE_ONE_SMS,
			matched: true,
		});
	});

	it("rejoins a trailing full stop after an inline maps link", () => {
		expect(extractAlertText(EXAMPLE_TWO)).toEqual({
			body: EXAMPLE_TWO_SMS,
			matched: true,
		});
	});

	it("accepts CRLF line endings", () => {
		expect(extractAlertText(EXAMPLE_ONE.replace(/\n/g, "\r\n"))).toEqual({
			body: EXAMPLE_ONE_SMS,
			matched: true,
		});
	});

	it("forwards the whole body with links removed when the template is missing", () => {
		const text = `Bike moved.\n${SENDGRID_LINK}\nPlease check.`;

		expect(extractAlertText(text)).toEqual({
			body: "Bike moved.Please check.",
			matched: false,
		});
	});
});
