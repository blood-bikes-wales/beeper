# Glossary

Terms used when talking about Beeper. Keep definitions short.

| Term | Meaning |
|------|---------|
| Beeper | This SMS routing service / Cloud Function project |
| Blood Bikes Wales | Charity/ops context Beeper supports (sender ID **BBWales**) |
| BikeTrac | Bike tracking system that originates alert SMS |
| Three Rings / 3r | Volunteer management system ([3r.org.uk](https://www.3r.org.uk)); source of who is on call and phone numbers |
| Rota | Named on-call schedule / role in Three Rings (e.g. Controller, Duty Trustee) |
| Controller | On-shift volunteer role; receives alerts only when Controller alerts are enabled |
| Duty Trustee | On-shift volunteer role; currently receives alerts in deployed environments |
| Shift | Time window on a rota with assigned volunteers |
| Directory | Three Rings volunteer profile (includes phone properties) |
| TelProperty | Three Rings telephone field used to find a volunteer’s mobile number |
| BBWales | Name shown as the SMS sender when Beeper forwards an alert |
| Twilio | SMS provider: receives the BikeTrac text and sends Beeper’s outbound texts |
| TWILIO_WEBHOOK_URL | Exact public URL Twilio posts to; used to validate request signatures |
| Plasma | Naming prefix for the Google Cloud projects (`plasma-production`, staging) |
| Cloud Functions Gen2 | Google’s HTTP function runtime Beeper deploys to (runs on Cloud Run under the hood) |
| Secret Manager | Google Cloud store for API keys and Twilio credentials injected into the function |
| receiveMessage | Name of Beeper’s single HTTP entrypoint |
| IncomingRequest | Datastore record of an inbound Twilio SMS |
| OutgoingMessage | Datastore record of a forwarded SMS (linked to the inbound message) |
| ThreeRingsCache | Datastore cache of Three Rings rota/directory responses |
| beeper-database | Named Datastore database in GCP |
| beeper-local | Local Datastore emulator project ID |
| ENABLE_CONTROLLER_ALERTS | Setting that must be on for Controllers to get SMS; off in current cloud config |
| Staging | Shared pre-production environment used to test changes before production |
| Production | Live environment that handles real alerts |
