# Staging first-apply — RESOLVED (2026-08-08)

Billing is linked and the staging stack was applied successfully under account `e.fflynn-harding@bloodbikes.wales`.

- GCP project: `plasma-staging-502110`
- Remote state: `gs://beeper-terraform-state/envs/staging/`
- Function URI: `https://beeper-dj6nqdzpfa-nw.a.run.app`
- Staging GitHub secret `TWILIO_WEBHOOK_URL` updated to that URI

Point a Twilio webhook / Messaging Service at the staging URL if you want live SMS tests against staging.

---

## Original blocker (historical)

### Root cause

Google Cloud would not enable required APIs because **billing was not linked** on `plasma-staging-502110`. Linking failed with **Cloud billing quota exceeded** (account already had 5 billed projects).

### Extra issue after billing linked

Default Compute / Cloud Build service accounts did not exist yet. Fixed by enabling Compute Engine and running:

```bash
gcloud beta services identity create --service=cloudbuild.googleapis.com --project=plasma-staging-502110
```

Then `terraform apply` (twice for the zip generation pin) succeeded.
