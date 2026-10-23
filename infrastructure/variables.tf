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

variable "gmail_client_id" {
  description = "OAuth client id used to refresh the Gmail mailbox token"
  type        = string
}

variable "gmail_client_secret" {
  description = "OAuth client secret used to refresh the Gmail mailbox token"
  type        = string
  sensitive   = true
}

variable "gmail_refresh_token" {
  description = "Refresh token for the Workspace mailbox that receives alert email"
  type        = string
  sensitive   = true
}

variable "gmail_watch_user" {
  description = "Workspace address of the mailbox the refresh token belongs to"
  type        = string
}

variable "gmail_alert_from" {
  description = "Sender address whose plain-text body is forwarded by SMS"
  type        = string
}