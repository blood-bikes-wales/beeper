# Project overview

## What this is

**Beeper** is a small automated service used by Blood Bikes Wales. When a tracked bike triggers an alert (for example a possible theft), Beeper makes sure the right people on call get that alert by text message.

It does not replace BikeTrac or the volunteer rota system. It sits in the middle: it receives the alert, checks who is on duty, and forwards the message.

## Who it’s for

- **Duty Trustees** and **Controllers** on the rota (people who need the alert)
- **Ops / tech volunteers** who run or deploy the service
- Anyone explaining to stakeholders how bike alerts reach on-call people

## How it works (simple)

1. BikeTrac sends an SMS alert to a Twilio phone number.
2. Twilio notifies Beeper (a secure web request).
3. Beeper asks Three Rings who is on shift right now as Duty Trustee (and Controller, when that option is enabled).
4. Beeper texts those people the same alert content (sender name **BBWales**).

## What success looks like

- On-call volunteers get timely SMS when a tracked bike alerts.
- Every inbound and outbound message is recorded for later review.
- Staging and production can be updated through the usual GitHub / cloud deploy process without manual server babysitting.

## Risks and limitations

- In deployed environments today, **Controller alerts are turned off**; only the **Duty Trustee** is texted unless that setting is changed.
- If the rota is wrong, empty, or has more than one person overlapping for a role, Beeper may fail to send rather than guess.
- Staging is shared across pull requests — the latest successful deploy is what staging is running.
- Beeper trusts Twilio’s signature check to prove requests are real; the public URL itself is not a secret.

## Where to learn more

- Technical overview: [../technical/overview.md](../technical/overview.md)
- Architecture: [../technical/architecture.md](../technical/architecture.md)
- Glossary: [glossary.md](glossary.md)
- DPIA: [Data Protection Impact Assessment](https://bloodbikeswales.atlassian.net/wiki/spaces/PD/pages/17924357/Data+Protection+Impact+Assessment+DPIA) (Confluence only)
- Root project README: [../../readme.md](../../readme.md)
