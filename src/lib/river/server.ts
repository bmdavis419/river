import z from 'zod';
import type {
	AgentRouter,
	CreateAgentRouter,
	CreateAiSdkRiverAgent,
	CreateCustomRiverAgent,
	HookForSafeCall,
	LifecycleHooks,
	ServerEndpointHandler,
	ServerSideAgentRunner
} from './types.js';
import { RiverError } from './errors.js';

const createAiSdkAgent: CreateAiSdkRiverAgent = ({ agent, inputSchema }) => {
	return {
		agent,
		inputSchema,
		type: 'ai-sdk'
	};
};

const createCustomAgent: CreateCustomRiverAgent = ({ agent, streamChunkSchema, inputSchema }) => {
	return {
		agent,
		inputSchema,
		type: 'custom',
		streamChunkSchema
	};
};

const createAgentRouter: CreateAgentRouter = (agents) => {
	return agents as any;
};

const createServerSideAgentRunner: ServerSideAgentRunner = (router) => {
	return {
		runAgent: async (args) => {
			const { agentId, input, streamController, abortController } = args;

			const encoder = new TextEncoder();

			const agent = router[agentId];

			if (agent.type === 'ai-sdk') {
				const { agent: aiSdkAgent } = agent;
				const { fullStream } = aiSdkAgent(input, abortController.signal);

				for await (const chunk of fullStream) {
					if (abortController.signal.aborted) {
						break;
					}

					const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
					streamController.enqueue(encoder.encode(sseChunk));
				}

				return;
			}

			const { agent: customAgent } = agent;

			await customAgent(input, (chunk) => {
				if (abortController.signal.aborted) {
					return;
				}

				const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
				streamController.enqueue(encoder.encode(sseChunk));
			});

			return;
		}
	};
};

const createServerEndpointHandler: ServerEndpointHandler = (router, hooks) => {
	const runner = createServerSideAgentRunner(router);
	return {
		POST: async (event) => {
			const body = await event.request.json();
			const abortController = new AbortController();

			event.request.signal.addEventListener(
				'abort',
				() => {
					abortController.abort();
				},
				{ once: true }
			);

			const bodySchema = z.object({
				agentId: z.string(),
				input: router[body.agentId].inputSchema
			});

			const bodyResult = bodySchema.safeParse(body);
			if (!bodyResult.success) {
				const error = new RiverError('Invalid body', bodyResult.error);
				return new Response(JSON.stringify(error), { status: 400 });
			}
			const { agentId, input } = bodyResult.data;

			const stream = new ReadableStream<Uint8Array>({
				async start(streamController) {
					// TODO: make it so that you can do some wait until and piping shit in here

					const defaultErrorHandler = async (err: unknown) => {
						if (hooks?.onError) {
							const error =
								err instanceof RiverError
									? err
									: new RiverError(`[RIVER:${agentId}] - Run Failed`, err);
							await callServerHook(hooks.onError, { event, agentId, input, error });
						} else {
							console.error('Unhandled error during agent run:', err);
						}
					};

					await callServerHook(hooks?.beforeAgentRun, { event, agentId, input, abortController });

					try {
						await runner.runAgent({
							agentId: bodyResult.data.agentId,
							input: bodyResult.data.input,
							streamController,
							abortController
						});
					} catch (error) {
						if (abortController.signal.aborted) {
							streamController.close();
						} else {
							streamController.error(error);

							await defaultErrorHandler(error);
						}
					} finally {
						streamController.close();
						await callServerHook(hooks?.afterAgentRun, { event, agentId, input });
					}
				},
				cancel(reason) {
					abortController.abort(reason);

					callServerHook(hooks?.onAbort, { event, agentId, input, reason });
				}
			});

			return new Response(stream);
		}
	};
};

async function callServerHook<T>(
	hook: HookForSafeCall<T> | undefined,
	args: T,
	globalOnError?: (err: unknown) => Promise<void>
) {
	if (!hook) return;

	try {
		if (typeof hook === 'function') {
			await hook(args);
		} else {
			await hook.try(args);
		}
	} catch (err) {
		if (hook && typeof hook !== 'function' && hook.catch) {
			await hook.catch(err, { ...args });
		} else if (globalOnError) {
			await globalOnError(err);
		} else {
			console.error('Unhandled hook error:', err);
		}
	}
}

export const RIVER_SERVER = {
	createAgentRouter,
	createAiSdkAgent,
	createCustomAgent,
	createServerEndpointHandler
};
