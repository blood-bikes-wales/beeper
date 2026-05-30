terraform {
    required_providers {
        google = {
            source = "hashicorp/google"
            version = "6.8.0"
        }
    }
}

provider "google" {
    project = "cool-furnace-497420-t4"
    region = "europe-west2"
    zone = "europe-west2-a"
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