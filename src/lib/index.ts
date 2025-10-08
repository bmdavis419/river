// Reexport your entry components here
export * from './river/types.js';
export * from './river/errors.js';
export * from './river/server.js';
export * from './river/client.js';

import * as RIVER_STREAMS from './v2_dev/streams.js';
import * as RIVER_AGENTS from './v2_dev/agents.js';
import * as RIVER_TYPES from './v2_dev/types.js';
import * as RIVER_SERVER from './v2_dev/server.js';
import * as RIVER_CLIENT from './v2_dev/client.svelte.js';
import * as RIVER_ERRORS from './v2_dev/errors.js';

export const V2_DEV = {
	RIVER_STREAMS,
	RIVER_AGENTS,
	RIVER_TYPES,
	RIVER_SERVER,
	RIVER_CLIENT,
	RIVER_ERRORS
};
