// here we fucking go
// for reference on my first idea: https://x.com/bmdavis419/status/1974429322502115403

import type { StreamTextResult, TextStreamPart, ToolSet } from 'ai';
import z from 'zod';
import { getAiStream } from './garbage.js';

// AGENT DEFINITION
type AiSdkRiverAgent<T extends ToolSet> = {
	__defs: {
		chunkType: T;
	};
	agent: () => StreamTextResult<T, never>;
	type: 'ai-sdk';
	// todo: before run guard, resumability pipe
};

// everything is SSE fuck you I own it all
// if u want text, it's going in SSE and you can't fucking stop me
type CustomRiverAgent<T> = {
	__defs: {
		chunkType: T;
	};
	type: 'custom';
	agent: (stream: ReadableStream<T>) => Promise<void>;
	streamChunkSchema: z.ZodType<T>;
};

type AnyRiverAgent = AiSdkRiverAgent<any> | CustomRiverAgent<any>;

type InferRiverAgentStreamChunk<T> =
	T extends AiSdkRiverAgent<infer Tools>
		? TextStreamPart<Tools>
		: T extends CustomRiverAgent<infer Chunk>
			? Chunk
			: never;

type InferRiverAgent<T> =
	T extends AiSdkRiverAgent<infer Tools>
		? AiSdkRiverAgent<Tools>
		: T extends CustomRiverAgent<infer Chunk>
			? CustomRiverAgent<Chunk>
			: never;

// so you end up with the two agent types being ai sdk and custom
// will probably have separate creation functions for each...

type CreateAiSdkRiverAgent = <T extends ToolSet>(args: {
	agent: () => StreamTextResult<T, never>;
}) => AiSdkRiverAgent<T>;

const createAiSdkRiverAgent: CreateAiSdkRiverAgent = ({ agent }) => {
	return {
		agent,
		__defs: {
			chunkType: Symbol as any
		},
		type: 'ai-sdk'
	};
};

type CreateCustomRiverAgent = <T>(args: {
	agent: (stream: ReadableStream<T>) => Promise<void>;
	streamChunkSchema: z.ZodType<T>;
}) => CustomRiverAgent<T>;

const createCustomRiverAgent: CreateCustomRiverAgent = ({ agent, streamChunkSchema }) => {
	return {
		agent,
		__defs: {
			chunkType: Symbol as any
		},
		type: 'custom',
		streamChunkSchema
	};
};

// AGENT ROUTER
type AgentRouter = {
	agents: Record<string, AnyRiverAgent>;
};

type DecoratedAgentRouter<T extends AgentRouter['agents']> = {
	agents: {
		[K in keyof T]: InferRiverAgent<T[K]>;
	};
};

type CreateAgentRouter = <T extends AgentRouter['agents']>(args: {
	agents: T;
}) => DecoratedAgentRouter<T>;

const createAgentRouter: CreateAgentRouter = ({ agents }) => {
	return {
		agents
	} as any; // it's ok, TS can stfu here
};

// SOME TESTING
const myFirstCustomAgent = createCustomRiverAgent({
	agent: async (stream) => {
		return;
	},
	streamChunkSchema: z.string()
});

const mySecondCustomAgent = createCustomRiverAgent({
	agent: async (stream) => {
		return;
	},
	streamChunkSchema: z.object({
		hello: z.string()
	})
});

const myFirstAiSdkAgent = createAiSdkRiverAgent({
	agent: getAiStream
});

const myFirstAgentRouter = createAgentRouter({
	agents: {
		customOne: myFirstCustomAgent,
		customTwo: mySecondCustomAgent,
		aiSdk: myFirstAiSdkAgent
	}
});

myFirstAgentRouter.agents.customOne.__defs.chunkType;
myFirstAgentRouter.agents.customTwo.__defs.chunkType;
