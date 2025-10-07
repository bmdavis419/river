import { V2_DEV } from '$lib/index.js';
import z from 'zod';

const myFirstV2AgentStream = V2_DEV.RIVER_STREAMS.createRiverStream(
	'my-first-v2-agent',
	V2_DEV.RIVER_STREAMS.riverStorageDefaultProvider
);

const myFirstV2Agent = V2_DEV.RIVER_AGENTS.createRiverAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	stream: myFirstV2AgentStream,
	runner: async (args) => {
		const { input, abortSignal, meta, stream, agentRunId } = args;

		console.log('STARTING A V2 AGENT');

		// TODO: keep grinding this out...
		// also need to figure out the typesafety on the stream, probably need to attach a type to the stream itself?
	}
});
