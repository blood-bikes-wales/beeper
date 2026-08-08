terraform {
  backend "gcs" {
    bucket = "beeper-terraform-state"
    # prefix is set per environment via -backend-config=backends/<env>.gcs.tfbackend
  }
}
