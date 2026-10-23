import { datastore } from "../datastore";

export class GmailSyncStore {
	async getHistoryId(mailbox: string): Promise<string | undefined> {
		const [entity] = await datastore.get(this.key(mailbox));
		const historyId = entity?.historyId;
		if (historyId === undefined || historyId === null || historyId === "") {
			return undefined;
		}

		return String(historyId);
	}

	async saveHistoryId(mailbox: string, historyId: string): Promise<void> {
		await datastore.save({
			key: this.key(mailbox),
			data: {
				mailbox,
				historyId,
				updatedAt: new Date().toISOString(),
			},
		});
	}

	private key(mailbox: string) {
		return datastore.key(["GmailSync", mailbox]);
	}
}
