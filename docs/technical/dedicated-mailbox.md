# Dedicated Gmail mailbox

Follow this before production leaves the developer inbox. The running service still has no login page. The mailbox is whichever Workspace user owns the refresh token.

## Create the mailbox

1. Create a dedicated Workspace user whose only job is to receive BikeTrac alert mail. It needs a normal mailbox, not an admin role.
2. Point BikeTrac, or a forward/filter, at that address.
3. Keep `GMAIL_ALERT_FROM` as the sender Beeper accepts. That value is not the mailbox.

## Move the watch

1. With the developer refresh token still in the environment, stop that inbox: `npm run authorize-gmail -- --stop`
2. Run `npm run authorize-gmail` again and sign in as the dedicated mailbox. Reuse the same Desktop OAuth client. The script prints the new address and a new refresh token.
3. Put the new refresh token in the production `GMAIL_REFRESH_TOKEN` secret, and set production `GMAIL_WATCH_USER` to the address the script prints.
4. Deploy.
5. Run `renewGmailWatch` once (`beeper-gmail-watch`) so `users.watch` starts on the new mailbox. The history cursor is stored per mailbox, so the new inbox gets its own `historyId`. The developer cursor is left unused.

## Check

- The notification Gmail sends as soon as `users.watch` succeeds has `emailAddress` equal to the dedicated mailbox.
- A test mail from `GMAIL_ALERT_FROM` to that inbox becomes an SMS to the on-call volunteer.
- Mail that arrives only in the developer inbox does not page anyone.
