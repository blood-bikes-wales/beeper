variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "three_rings_api_key" {
  description = "Three Rings API key, injected into the Cloud Function via Secret Manager"
  type        = string
  sensitive   = true
}

variable "twilio_account_sid" {
  description = "Twilio account SID, injected into the Cloud Function via Secret Manager"
  type        = string
  sensitive   = true
}

variable "twilio_auth_token" {
  description = "Twilio auth token, injected into the Cloud Function via Secret Manager"
  type        = string
  sensitive   = true
}

variable "twilio_webhook_url" {
  description = "Full Twilio webhook URL for request signature validation"
  type        = string
}