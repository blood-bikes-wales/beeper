#!/usr/bin/env bash
# One-time bootstrap: create the shared GCS bucket for Terraform remote state.
# The app Terraform stack cannot own this bucket (chicken-and-egg with the backend).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-plasma-production}"
BUCKET_NAME="${BUCKET_NAME:-beeper-terraform-state}"
LOCATION="${LOCATION:-europe-west2}"

if gcloud storage buckets describe "gs://${BUCKET_NAME}" >/dev/null 2>&1; then
	echo "Bucket gs://${BUCKET_NAME} already exists."
else
	gcloud storage buckets create "gs://${BUCKET_NAME}" \
		--project="${PROJECT_ID}" \
		--location="${LOCATION}" \
		--uniform-bucket-level-access
	echo "Created gs://${BUCKET_NAME}"
fi

gcloud storage buckets update "gs://${BUCKET_NAME}" --versioning
echo "Versioning enabled on gs://${BUCKET_NAME}"
echo
echo "Grant deploy SAs and humans roles/storage.objectAdmin on this bucket, e.g.:"
echo "  gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \\"
echo "    --member=serviceAccount:DEPLOY_SA@${PROJECT_ID}.iam.gserviceaccount.com \\"
echo "    --role=roles/storage.objectAdmin"
