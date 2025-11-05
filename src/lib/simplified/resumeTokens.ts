import { err, ok, Result } from 'neverthrow';
import type {
	DecodeRiverResumptionTokenFunc,
	EncodeRiverResumptionTokenFunc,
	RiverResumptionToken
} from './types.js';
import { RiverError } from './errors.js';

export const decodeRiverResumptionToken: DecodeRiverResumptionTokenFunc = (token: string) => {
	const result = Result.fromThrowable(
		() => {
			const decodedStr = atob(token);
			return JSON.parse(decodedStr);
		},
		(error) => {
			return new RiverError('Failed to decode resumption token', error, 'internal');
		}
	)();

	if (result.isErr()) {
		return result;
	}

	if (
		!result.value ||
		typeof result.value !== 'object' ||
		!('providerId' in result.value) ||
		!('streamStorageId' in result.value) ||
		!('streamRunId' in result.value) ||
		!('streamRouterKey' in result.value)
	) {
		return err(new RiverError('Invalid resumption token', undefined, 'internal'));
	}

	return ok(result.value as RiverResumptionToken);
};

export const encodeRiverResumptionToken: EncodeRiverResumptionTokenFunc = (token) => {
	return Result.fromThrowable(
		() => {
			return btoa(JSON.stringify(token));
		},
		(error) => {
			return new RiverError('Failed to encode resumption token', error, 'internal');
		}
	)();
};
