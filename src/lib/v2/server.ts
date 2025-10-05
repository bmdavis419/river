// here we fucking go
// for reference on my first idea: https://x.com/bmdavis419/status/1974429322502115403

import type { StreamTextResult, TextStreamPart, ToolSet } from 'ai';
import z from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import { RiverError } from './errors.js';

// AGENT DEFINITION
type AiSdkRiverAgent<T extends ToolSet, I> = {
	_phantom?: {
		chunkType: TextStreamPart<T>;
		inputType: I;
	};
	agent: (input: I) => StreamTextResult<T, never>;
	type: 'ai-sdk';
	inputSchema: z.ZodType<I>;
	// todo: before run guard, resumability pipe
};

// everything is SSE fuck you I own it all
// if u want text, it's going in SSE and you can't fucking stop me
// the stream should actually be guarded here...
type CustomRiverAgent<T, I> = {
	_phantom?: {
		chunkType: T;
		inputType: I;
	};
	type: 'custom';
	agent: (input: I, appendToStream: (chunk: T) => void) => Promise<void>;
	streamChunkSchema: z.ZodType<T>;
	inputSchema: z.ZodType<I>;
};

type AnyRiverAgent = AiSdkRiverAgent<any, any> | CustomRiverAgent<any, any>;

type InferRiverAgentChunkType<T> = T extends { _phantom?: { chunkType: infer Chunk } }
	? Chunk
	: never;
type InferRiverAgentInputType<T> = T extends { _phantom?: { inputType: infer Input } }
	? Input
	: never;

type InferRiverAgent<T> =
	T extends AiSdkRiverAgent<infer Tools, infer Input>
		? AiSdkRiverAgent<Tools, Input>
		: T extends CustomRiverAgent<infer Chunk, infer Input>
			? CustomRiverAgent<Chunk, Input>
			: never;

// so you end up with the two agent types being ai sdk and custom
// will probably have separate creation functions for each...

type CreateAiSdkRiverAgent = <T extends ToolSet, I>(args: {
	agent: (input: I) => StreamTextResult<T, never>;
	inputSchema: z.ZodType<I>;
}) => AiSdkRiverAgent<T, I>;

const createAiSdkRiverAgent: CreateAiSdkRiverAgent = ({ agent, inputSchema }) => {
	return {
		agent,
		inputSchema,
		type: 'ai-sdk'
	};
};

type CreateCustomRiverAgent = <T, I>(args: {
	agent: (input: I, appendToStream: (chunk: T) => void) => Promise<void>;
	streamChunkSchema: z.ZodType<T>;
	inputSchema: z.ZodType<I>;
}) => CustomRiverAgent<T, I>;

const createCustomRiverAgent: CreateCustomRiverAgent = ({
	agent,
	streamChunkSchema,
	inputSchema
}) => {
	return {
		agent,
		inputSchema,
		type: 'custom',
		streamChunkSchema
	};
};

// AGENT ROUTER
type AgentRouter = Record<string, AnyRiverAgent>;

type DecoratedAgentRouter<T extends AgentRouter> = {
	[K in keyof T]: InferRiverAgent<T[K]>;
};

type CreateAgentRouter = <T extends AgentRouter>(agents: T) => DecoratedAgentRouter<T>;

const createAgentRouter: CreateAgentRouter = (agents) => {
	return agents as any;
};

// ok so a few notes to self:
// all agents will be sending SSE streams no matter what fuck you
// the schemas on custom agents exist on the server for validation, they don't need to be on the client
// this means the only thing going from client to server is the agent router type which is huge
// NEW TODOS:
// - serverside call functions for each agent type
// - agent runner endpoint generator for actually sending the streams
// - client side caller

type ServerSideAgentRunner = <T extends AgentRouter>(
	router: DecoratedAgentRouter<T>
) => {
	runAgent: <K extends keyof T>(args: {
		agentId: K;
		input: InferRiverAgentInputType<T[K]>;
		streamController: ReadableStreamDefaultController<Uint8Array>;
		abortController: AbortController;
	}) => Promise<void>;
};

const createServerSideAgentRunner: ServerSideAgentRunner = (router) => {
	return {
		runAgent: async (args) => {
			const { agentId, input, streamController, abortController } = args;

			const encoder = new TextEncoder();

			const agent = router[agentId];

			if (agent.type === 'ai-sdk') {
				const { agent: aiSdkAgent } = agent;
				const { fullStream } = aiSdkAgent(input);

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

type ServerEndpointHandler = <T extends AgentRouter>(
	router: DecoratedAgentRouter<T>
) => { POST: (event: RequestEvent) => Promise<Response> };

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

export {
	createServerEndpointHandler,
	createCustomRiverAgent,
	createAiSdkRiverAgent,
	createAgentRouter
};
export type {
	InferRiverAgentInputType,
	InferRiverAgentChunkType,
	DecoratedAgentRouter,
	AgentRouter
};
