terraform {
    required_providers {
        google = {
            source = "hashicorp/google"
            version = "6.8.0"
        }
    }
}

provider "google" {
    project = var.project_id
    region = "europe-west2"
    zone = "europe-west2-a"
}

module "project-services" {
    source = "terraform-google-modules/project-factory/google"
    version = "~> 18.2"
    project_id = var.project_id
    name = "beeper"
    billing_account = var.billing_account

    activate_apis = [
        "artifactregistry.googleapis.com",
        "cloudfunctions.googleapis.com",
        "cloudbuild.googleapis.com",
        "run.googleapis.com",
        "storage.googleapis.com",
        "datastore.googleapis.com",
    ]

    disable_services_on_destroy = true
}

resource "google_storage_bucket" "bucket" {
    name = "beeper-bucket"
    location = "europe-west2"
}

resource "google_storage_bucket_object" "object" {
    name = "beeper.zip"
    bucket = google_storage_bucket.bucket.name
    source = "../dist.zip"
}

data "google_project" "current" {
    project_id = var.project_id
}

locals {
    compute_sa   = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
    cloudbuild_sa  = "${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

# Gen2 builds read source from GCS using the default compute SA (new projects no longer auto-grant this).
resource "google_storage_bucket_iam_member" "source_compute_reader" {
    bucket = google_storage_bucket.bucket.name
    role   = "roles/storage.objectViewer"
    member = "serviceAccount:${local.compute_sa}"
}

resource "google_storage_bucket_iam_member" "source_cloudbuild_reader" {
    bucket = google_storage_bucket.bucket.name
    role   = "roles/storage.objectViewer"
    member = "serviceAccount:${local.cloudbuild_sa}"
}

resource "google_project_iam_member" "compute_cloudfunctions_developer" {
    project = data.google_project.current.project_id
    role    = "roles/cloudfunctions.developer"
    member  = "serviceAccount:${local.compute_sa}"
}

resource "google_project_iam_member" "compute_datastore_user" {
    project = data.google_project.current.project_id
    role    = "roles/datastore.user"
    member  = "serviceAccount:${local.compute_sa}"
}

resource "google_cloudfunctions2_function" "beeper_function" {
    depends_on = [
        module.project-services,
        google_storage_bucket_iam_member.source_compute_reader,
        google_storage_bucket_iam_member.source_cloudbuild_reader,
        google_project_iam_member.compute_cloudfunctions_developer,
    ]

    name        = "beeper"
    location    = "europe-west2"
    description = "A function that receives inbound SMS alerts from a bike tracking system (BikeTrac) via Twilio, looks up the on-call volunteers from Three Rings, and forwards the alert to the current Controller and Duty Trustee by SMS."

    build_config {
        runtime     = "nodejs24"
        entry_point = "receiveMessage"
        source {
            storage_source {
                bucket = google_storage_bucket.bucket.name
                object = google_storage_bucket_object.object.name
            }
        }
    }

    service_config {
        available_memory = "128Mi"
        timeout_seconds  = 10
        max_instance_count = 1
        min_instance_count = 0
    }
}

resource "google_cloud_run_service_iam_member" "beeper_public_invoker" {
    location = google_cloudfunctions2_function.beeper_function.location
    service  = google_cloudfunctions2_function.beeper_function.name
    role     = "roles/run.invoker"
    member   = "allUsers"

    depends_on = [google_cloudfunctions2_function.beeper_function]
}