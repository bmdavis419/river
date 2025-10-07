import z from 'zod';

export type RiverErrorCode =
	| 'BAD_REQUEST'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'METHOD_NOT_SUPPORTED'
	| 'TIMEOUT'
	| 'CONFLICT'
	| 'PRECONDITION_FAILED'
	| 'PAYLOAD_TOO_LARGE'
	| 'UNPROCESSABLE_CONTENT'
	| 'TOO_MANY_REQUESTS'
	| 'CLIENT_CLOSED_REQUEST'
	| 'INTERNAL_SERVER_ERROR'
	| 'NOT_IMPLEMENTED'
	| 'BAD_GATEWAY'
	| 'SERVICE_UNAVAILABLE'
	| 'GATEWAY_TIMEOUT';

/**
 * Zod enum for `RiverErrorCode` to enable schema validation on the client.
 */
export const RiverErrorCodeSchema = z.enum([
	'BAD_REQUEST',
	'UNAUTHORIZED',
	'FORBIDDEN',
	'NOT_FOUND',
	'METHOD_NOT_SUPPORTED',
	'TIMEOUT',
	'CONFLICT',
	'PRECONDITION_FAILED',
	'PAYLOAD_TOO_LARGE',
	'UNPROCESSABLE_CONTENT',
	'TOO_MANY_REQUESTS',
	'CLIENT_CLOSED_REQUEST',
	'INTERNAL_SERVER_ERROR',
	'NOT_IMPLEMENTED',
	'BAD_GATEWAY',
	'SERVICE_UNAVAILABLE',
	'GATEWAY_TIMEOUT'
]);

/**
 * Mapping from `RiverErrorCode` to an appropriate HTTP status code. Used when
 * formatting errors for HTTP responses or SSE error frames.
 */
const HTTP_STATUS_FROM_CODE: Record<RiverErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_SUPPORTED: 405,
	TIMEOUT: 408,
	CONFLICT: 409,
	PRECONDITION_FAILED: 412,
	PAYLOAD_TOO_LARGE: 413,
	UNPROCESSABLE_CONTENT: 422,
	TOO_MANY_REQUESTS: 429,
	CLIENT_CLOSED_REQUEST: 499,
	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504
};

/**
 * Derive a `RiverErrorCode` from an HTTP status. Used client-side when
 * converting non-OK HTTP responses into normalized River errors.
 */
export const codeFromStatus = (status: number): RiverErrorCode => {
	switch (status) {
		case 400:
			return 'BAD_REQUEST';
		case 401:
			return 'UNAUTHORIZED';
		case 403:
			return 'FORBIDDEN';
		case 404:
			return 'NOT_FOUND';
		case 405:
			return 'METHOD_NOT_SUPPORTED';
		case 408:
			return 'TIMEOUT';
		case 409:
			return 'CONFLICT';
		case 412:
			return 'PRECONDITION_FAILED';
		case 413:
			return 'PAYLOAD_TOO_LARGE';
		case 422:
			return 'UNPROCESSABLE_CONTENT';
		case 429:
			return 'TOO_MANY_REQUESTS';
		case 499:
			return 'CLIENT_CLOSED_REQUEST';
		case 500:
			return 'INTERNAL_SERVER_ERROR';
		case 501:
			return 'NOT_IMPLEMENTED';
		case 502:
			return 'BAD_GATEWAY';
		case 503:
			return 'SERVICE_UNAVAILABLE';
		case 504:
			return 'GATEWAY_TIMEOUT';
		default:
			// Heuristic defaults: bucket other 4xx to BAD_REQUEST and other 5xx to INTERNAL
			if (status >= 500) return 'INTERNAL_SERVER_ERROR';
			if (status >= 400) return 'BAD_REQUEST';
			return 'INTERNAL_SERVER_ERROR';
	}
};

/**
 * JSON-serializable shape of a River error. This is the payload sent to clients
 * over HTTP (for non-OK responses) and SSE error frames (`event: error`).
 *
 * - `message`: human-readable description for display and logs
 * - `code`: TRPC-style error code describing the error category
 * - `httpStatus`: optional HTTP status to use in responses
 * - `agentId`: optional agent identifier where the error occurred
 * - `details`: optional structured metadata (e.g., zod issues)
 */
export type RiverErrorJSON = {
	message: string;
	code: RiverErrorCode;
	httpStatus?: number;
	agentId?: string;
	details?: unknown;
};

/**
 * Zod schema for `RiverErrorJSON` with `passthrough()` to allow forwards-compatible
 * fields without breaking validation. Used on the client when parsing HTTP/SSE
 * error payloads with `safeParse`.
 */
export const RiverErrorJSONSchema = z
	.object({
		message: z.string(),
		code: RiverErrorCodeSchema,
		httpStatus: z.number().optional(),
		agentId: z.string().optional(),
		details: z.unknown().optional()
	})
	.loose();

export class RiverError extends Error {
	__name__ = 'RiverError';
	message: string;
	code: RiverErrorCode;
	httpStatus?: number;
	agentId?: string;
	cause?: unknown;
	details?: unknown;

	constructor(
		message: string,
		options?: {
			code?: RiverErrorCode;
			httpStatus?: number;
			agentId?: string;
			cause?: unknown;
			details?: unknown;
		}
	) {
		super(message);
		this.name = 'RiverError';
		this.message = message;
		const opts = options ?? {};
		this.code = opts.code ?? 'INTERNAL_SERVER_ERROR';
		this.httpStatus = opts.httpStatus ?? HTTP_STATUS_FROM_CODE[this.code];
		this.agentId = opts.agentId;
		this.cause = opts.cause;
		this.details = opts.details;
	}

	/**
	 * Runtime type guard that checks whether a value is a `RiverError`.
	 */
	static isRiverError(err: unknown): err is RiverError {
		return (
			!!err &&
			typeof err === 'object' &&
			('__name__' in err
				? (err as any).__name__ === 'RiverError'
				: false || (err as any).name === 'RiverError')
		);
	}

	/**
	 * Normalize an unknown thrown value into a `RiverError`, using the provided
	 * `fallbackCode` when the value does not already represent a River error.
	 */
	static fromUnknown(
		err: unknown,
		fallbackCode: RiverErrorCode = 'INTERNAL_SERVER_ERROR'
	): RiverError {
		if (RiverError.isRiverError(err)) return err as RiverError;
		if (err instanceof Error) {
			return new RiverError(err.message || 'Unknown error', { code: fallbackCode, cause: err });
		}
		return new RiverError('Unknown error', { code: fallbackCode, cause: err });
	}

	/**
	 * Convert a `RiverError` instance to a JSON-serializable payload for
	 * transport over HTTP or SSE.
	 */
	static toJSON(err: RiverError): RiverErrorJSON {
		return {
			message: err.message,
			code: err.code,
			httpStatus: err.httpStatus,
			agentId: err.agentId,
			details: err.details
		};
	}

	/**
	 * Reconstruct a `RiverError` instance from a serialized JSON payload.
	 */
	static fromJSON(json: RiverErrorJSON): RiverError {
		return new RiverError(json.message, {
			code: json.code,
			httpStatus: json.httpStatus,
			agentId: json.agentId,
			details: json.details
		});
	}
}
