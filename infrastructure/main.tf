terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "6.8.0"
    }
  }
}

provider "google" {
  project               = var.project_id
  billing_project       = var.project_id
  user_project_override = true
  region                = "europe-west2"
  zone                  = "europe-west2-a"
}

# Enables APIs on an existing project (does not create the project).
module "project-services" {
  source  = "terraform-google-modules/project-factory/google//modules/project_services"
  version = "~> 18.2"

  project_id = var.project_id

  activate_apis = [
    "artifactregistry.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
    "datastore.googleapis.com",
    "secretmanager.googleapis.com",
    "firestore.googleapis.com",
    "logging.googleapis.com"
  ]

  disable_services_on_destroy = false
}

resource "google_storage_bucket" "bucket" {
  name     = "beeper-${var.project_id}"
  location = "europe-west2"
}

resource "google_storage_bucket_object" "object" {
  name   = "beeper.zip"
  bucket = google_storage_bucket.bucket.name
  source = "../dist.zip"
}

data "google_project" "current" {
  project_id = var.project_id
}

locals {
  compute_sa    = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
  cloudbuild_sa = "${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
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

resource "google_project_iam_member" "compute_secret_accessor" {
  project = data.google_project.current.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${local.compute_sa}"
}

resource "google_secret_manager_secret" "three_rings_api_key" {
  secret_id = "three-rings-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [module.project-services]
}

resource "google_secret_manager_secret_version" "three_rings_api_key" {
  secret      = google_secret_manager_secret.three_rings_api_key.id
  secret_data = var.three_rings_api_key
}

resource "google_secret_manager_secret" "twilio_account_sid" {
  secret_id = "twilio-account-sid"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [module.project-services]
}

resource "google_secret_manager_secret_version" "twilio_account_sid" {
  secret      = google_secret_manager_secret.twilio_account_sid.id
  secret_data = var.twilio_account_sid
}

resource "google_secret_manager_secret" "twilio_auth_token" {
  secret_id = "twilio-auth-token"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [module.project-services]
}

resource "google_secret_manager_secret_version" "twilio_auth_token" {
  secret      = google_secret_manager_secret.twilio_auth_token.id
  secret_data = var.twilio_auth_token
}

resource "google_cloudfunctions2_function" "beeper_function" {
  depends_on = [
    module.project-services,
    google_storage_bucket_iam_member.source_compute_reader,
    google_storage_bucket_iam_member.source_cloudbuild_reader,
    google_project_iam_member.compute_cloudfunctions_developer,
    google_project_iam_member.compute_datastore_user,
    google_project_iam_member.compute_secret_accessor,
    google_firestore_database.database,
    google_secret_manager_secret_version.three_rings_api_key,
    google_secret_manager_secret_version.twilio_account_sid,
    google_secret_manager_secret_version.twilio_auth_token,
  ]

  name        = "beeper"
  location    = "europe-west2"
  description = "A function that receives inbound SMS alerts from a bike tracking system (BikeTrac) via Twilio, looks up the on-call volunteers from Three Rings, and forwards the alert to the current Controller and Duty Trustee by SMS."

  build_config {
    runtime     = "nodejs24"
    entry_point = "receiveMessage"
    source {
      storage_source {
        bucket     = google_storage_bucket.bucket.name
        object     = google_storage_bucket_object.object.name
        generation = google_storage_bucket_object.object.generation
      }
    }
  }

  service_config {
    available_memory   = "256Mi"
    timeout_seconds    = 10
    max_instance_count = 1
    min_instance_count = 0

    environment_variables = {
      GCP_PROJECT_ID           = var.project_id
      DATASTORE_DATABASE_ID    = google_firestore_database.database.name
      TWILIO_WEBHOOK_URL       = var.twilio_webhook_url
      ENABLE_CONTROLLER_ALERTS = false
    }

    secret_environment_variables {
      key        = "THREE_RINGS_API_KEY"
      project_id = data.google_project.current.number
      secret     = google_secret_manager_secret.three_rings_api_key.secret_id
      version    = "latest"
    }

    secret_environment_variables {
      key        = "TWILIO_ACCOUNT_SID"
      project_id = data.google_project.current.number
      secret     = google_secret_manager_secret.twilio_account_sid.secret_id
      version    = "latest"
    }

    secret_environment_variables {
      key        = "TWILIO_AUTH_TOKEN"
      project_id = data.google_project.current.number
      secret     = google_secret_manager_secret.twilio_auth_token.secret_id
      version    = "latest"
    }
  }
}

resource "google_cloud_run_service_iam_member" "beeper_public_invoker" {
  location = google_cloudfunctions2_function.beeper_function.location
  service  = google_cloudfunctions2_function.beeper_function.name
  role     = "roles/run.invoker"
  member   = "allUsers"

  depends_on = [google_cloudfunctions2_function.beeper_function]
}

resource "google_cloudfunctions2_function" "three_rings_hot_cache" {
  depends_on = [
    module.project-services,
    google_storage_bucket_iam_member.source_compute_reader,
    google_storage_bucket_iam_member.source_cloudbuild_reader,
    google_project_iam_member.compute_cloudfunctions_developer,
    google_project_iam_member.compute_datastore_user,
    google_project_iam_member.compute_secret_accessor,
    google_firestore_database.database,
    google_secret_manager_secret_version.three_rings_api_key,
  ]

  name        = "beeper-three-rings-hot-cache"
  location    = "europe-west2"
  description = "Warms the Three Rings rota cache in Datastore so inbound SMS handling avoids a cold Three Rings fetch."

  build_config {
    runtime     = "nodejs24"
    entry_point = "threeRingsHotCache"
    source {
      storage_source {
        bucket     = google_storage_bucket.bucket.name
        object     = google_storage_bucket_object.object.name
        generation = google_storage_bucket_object.object.generation
      }
    }
  }

  service_config {
    available_memory   = "256Mi"
    timeout_seconds    = 30
    max_instance_count = 1
    min_instance_count = 0

    environment_variables = {
      GCP_PROJECT_ID        = var.project_id
      DATASTORE_DATABASE_ID = google_firestore_database.database.name
    }

    secret_environment_variables {
      key        = "THREE_RINGS_API_KEY"
      project_id = data.google_project.current.number
      secret     = google_secret_manager_secret.three_rings_api_key.secret_id
      version    = "latest"
    }
  }
}

resource "google_service_account" "hot_cache_scheduler" {
  account_id   = "beeper-hot-cache-scheduler"
  display_name = "Beeper Three Rings hot cache scheduler"
  project      = var.project_id

  depends_on = [module.project-services]
}

# Gen2 functions are Cloud Run services; invoker must be re-applied after function
# replace (recreate clears the Run IAM policy while Terraform may keep this member).
resource "google_cloud_run_service_iam_member" "hot_cache_scheduler_invoker" {
  location = google_cloudfunctions2_function.three_rings_hot_cache.location
  project  = var.project_id
  service  = google_cloudfunctions2_function.three_rings_hot_cache.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.hot_cache_scheduler.email}"

  depends_on = [google_cloudfunctions2_function.three_rings_hot_cache]
}

resource "google_cloud_scheduler_job" "three_rings_hot_cache" {
  name        = "beeper-three-rings-hot-cache"
  description = "Refresh today's Three Rings rota cache before inbound SMS handling needs it."
  schedule    = "0 * * * *"
  time_zone   = "Europe/London"
  region      = "europe-west2"
  project     = var.project_id

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.three_rings_hot_cache.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.hot_cache_scheduler.email
      # Explicit audience avoids auth failures after function recreate / URI churn.
      audience = google_cloudfunctions2_function.three_rings_hot_cache.service_config[0].uri
    }
  }

  depends_on = [
    module.project-services,
    google_cloud_run_service_iam_member.hot_cache_scheduler_invoker,
  ]
}

resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "beeper-database"
  location_id = "europe-west2"
  type        = "DATASTORE_MODE"
}

# Delete entities after expiresAt (Three Rings cache: 24h; message logs: 28 days).
resource "google_firestore_field" "three_rings_cache_ttl" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "ThreeRingsCache"
  field      = "expiresAt"

  ttl_config {}
}

resource "google_firestore_field" "incoming_request_ttl" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "IncomingRequest"
  field      = "expiresAt"

  ttl_config {}
}

resource "google_firestore_field" "outgoing_message_ttl" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "OutgoingMessage"
  field      = "expiresAt"

  ttl_config {}
}

# Cloud Function (Gen2 / Cloud Run) stdout goes to the project's _Default log bucket.
# Align retention with Datastore IncomingRequest / OutgoingMessage (28 days).
resource "google_logging_project_bucket_config" "default" {
  project        = var.project_id
  location       = "global"
  bucket_id      = "_Default"
  retention_days = 28
  description    = "Default logs including Beeper Cloud Function; retained 28 days"

  depends_on = [module.project-services]
}