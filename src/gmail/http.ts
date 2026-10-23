import axios from "axios";

// The Google API client uses gaxios, which dynamically imports node-fetch. Jest cannot
// load that import, and nock does not see native fetch. Route Gmail and token
// requests through axios, which tests already pin to the Node http adapter.
export const axiosFetch: typeof fetch = async (input, init) => {
	const response = await axios.request({
		url: requestUrl(input),
		method: init?.method ?? "GET",
		data: requestBody(init?.body),
		headers: headerRecord(init?.headers),
		validateStatus: () => true,
		responseType: "arraybuffer",
	});

	return new Response(new Uint8Array(response.data), {
		status: response.status,
		headers: headerRecord(response.headers),
	});
};

function requestBody(body: unknown): unknown {
	if (body instanceof URLSearchParams) {
		return body.toString();
	}

	return body;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
	if (typeof input === "string") {
		return input;
	}

	if (input instanceof URL) {
		return input.toString();
	}

	return input.url;
}

function headerRecord(headers: unknown): Record<string, string> {
	if (!headers) {
		return {};
	}

	if (headers instanceof Headers) {
		return Object.fromEntries(headers.entries());
	}

	if (Array.isArray(headers)) {
		return Object.fromEntries(headers);
	}

	const record: Record<string, string> = {};
	for (const [key, value] of Object.entries(
		headers as Record<string, unknown>,
	)) {
		if (value === undefined || value === null) {
			continue;
		}

		if (Array.isArray(value)) {
			record[key] = value.map(String).join(", ");
			continue;
		}

		record[key] = String(value);
	}

	return record;
}
