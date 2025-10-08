import { err, ok, ResultAsync } from 'neverthrow';
import type { ServerEndpointHandler, ServerSideAgentRunner } from './types.js';
import { RiverError } from './errors.js';

const runAgentOnServer: ServerSideAgentRunner = async (
	agentRunner,
	activeStream,
	validatedInput,
	abortSignal,
	frameworkMeta
) => {
	const { appendChunk: streamAppendChunk, close } = activeStream;

	try {
		console.log('running agent');
		await agentRunner({
			input: validatedInput,
			stream: {
				appendChunk: (chunk) => {
					if (abortSignal.aborted) {
						return;
					}

					streamAppendChunk(chunk);
				}
			},
			agentRunId: 'TODO',
			meta: frameworkMeta,
			abortSignal
		});
		console.log('agent ran');
	} catch (e) {
		return err(new RiverError('Failed to run agent', { cause: e }));
	} finally {
		console.log('closing stream');
		close();
	}

	return ok();
};

const createServerEndpointHandler: ServerEndpointHandler = (router) => {
	return {
		POST: async (event) => {
			const abortController = new AbortController();

			event.request.signal.addEventListener(
				'abort',
				() => {
					abortController.abort();
				},
				{ once: true }
			);

			const body = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', { cause: e })
			);

			if (body.isErr()) {
				return new Response(JSON.stringify(body.error), { status: 400 });
			}

			const agentId = body.value.agentId;

			if (!agentId) {
				return new Response(
					JSON.stringify(new RiverError('Agent ID is required', { cause: 'Agent ID is required' })),
					{ status: 400 }
				);
			}

			const agent = router[agentId];

			if (!agent) {
				return new Response(
					JSON.stringify(new RiverError('Agent not found', { cause: 'Agent not found' })),
					{
						status: 400
					}
				);
			}

			const initResult = await ResultAsync.fromPromise(
				agent.stream.storage.init({
					streamId: agent.stream.streamId,
					agentRunId: 'TODO'
				}),
				(e) => new RiverError('Failed to initialize stream storage', { cause: e })
			);

			if (initResult.isErr()) {
				return new Response(JSON.stringify(initResult.error), { status: 400 });
			}

			const validatedInputResult = await ResultAsync.fromPromise(
				agent.inputSchema.parseAsync(body.value.input),
				(e) => new RiverError('Failed to validate input', { cause: e })
			);

			if (validatedInputResult.isErr()) {
				return new Response(JSON.stringify(validatedInputResult.error), { status: 400 });
			}

			runAgentOnServer(
				agent.runner,
				initResult.value,
				validatedInputResult.value,
				abortController.signal,
				{
					event,
					framework: 'sveltekit'
				}
			);

			return new Response(initResult.value.stream);
		}
	};
};

export const RIVER_SERVER = { createServerEndpointHandler };
