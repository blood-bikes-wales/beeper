# Project documentation

Local markdown in this folder is the source of truth for how Beeper works. Technical pages are for engineers and tooling; non-technical pages are for stakeholders.

Confluence sync (if used) is handled by the **docs-sync** skill.

## Layout

| Path | Audience |
|------|----------|
| [technical/](technical/) | Engineering: overview, architecture, ops notes |
| [non-technical/](non-technical/) | Product / ops stakeholders: plain-language overview and glossary |

## Technical

- [Overview](technical/overview.md) — purpose, stack, entrypoints, how to run
- [Architecture](technical/architecture.md) — components, flow, integrations
- [Local Twilio webhook](technical/local-twilio-webhook.md) — tunnel + emulator testing runbook
- [Staging first-apply blocker](technical/staging-first-apply-blocker.md) — resolved staging bootstrap notes (historical)

## Non-technical

- [Overview](non-technical/overview.md) — what Beeper does and who it serves
- [Glossary](non-technical/glossary.md) — shared terms
- [DPIA](https://bloodbikeswales.atlassian.net/wiki/spaces/PD/pages/17924357/Data+Protection+Impact+Assessment+DPIA) — Data Protection Impact Assessment (Confluence only; not stored in this repo)
