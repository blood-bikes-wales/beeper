variable "project_id" {
    description = "GCP project ID"
    type        = string
}

variable "billing_account" {
    description = "GCP billing account ID (e.g. XXXXXX-XXXXXX-XXXXXX)"
    type        = string
    sensitive   = true
}
