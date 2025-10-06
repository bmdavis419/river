import z from 'zod';
import type {
	CreateAgentRouter,
	CreateAiSdkRiverAgent,
	CreateCustomRiverAgent,
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

const createServerEndpointHandler: ServerEndpointHandler = (router) => {
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

			const stream = new ReadableStream<Uint8Array>({
				async start(streamController) {
					// TODO: make it so that you can do some wait until and piping shit in here
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
						}
					} finally {
						streamController.close();
					}
				},
				cancel(reason) {
					abortController.abort(reason);
				}
			});

			return new Response(stream);
		}
	};
};

export const RIVER_SERVER = {
	createAgentRouter,
	createAiSdkAgent,
	createCustomAgent,
	createServerEndpointHandler
};
