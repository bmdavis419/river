import { RIVER_AGENTS, RIVER_SERVER, RIVER_STREAMS } from '$lib/index.js';
import z from 'zod';
import { demoAiStream } from './garbage.js';

import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
	streamText,
	type AsyncIterableStream,
	type ModelMessage,
	type StreamTextResult,
	type TextStreamPart,
	type ToolSet
} from 'ai';

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

// TODO: make this a utility type in library, also need to figure out a really first class way to handle ai sdk streams...
type InferAiSdkChunkType<T> = T extends AsyncIterableStream<infer ChunkType> ? ChunkType : never;

// AI SDK helper scratch...
// make it so that you can pass a stream text into some helper which will make it trial for you to send the data from the AI SDK stream to the river stream...

type RiverAiSdkStreamHandler = <StreamTools extends ToolSet>(
	streamTextCall: () => StreamTextResult<StreamTools, never>,
	interceptChunk: (
		curChunk: TextStreamPart<StreamTools>,
		writeChunk: (chunk: TextStreamPart<StreamTools>) => void
	) => Promise<void> | void
) => {};

const riverHandleAiSdkStream = <ChunkType>(stream: AsyncIterableStream<ChunkType>) => {};

// CHAT AGENT
const chatAiSdkCall = (messages: ModelMessage[], abortSignal: AbortSignal) => {
	const vercelBoi = streamText({
		abortSignal,
		system:
			"You are an assistant designed to help answer the user's questions. Always respond in normal text format.",
		model: openrouter('meta-llama/llama-4-maverick:free'),
		messages
	});

	return {
		fullStream: vercelBoi.fullStream
	};
};

type ChatAiSdkChunkType = InferAiSdkChunkType<ReturnType<typeof chatAiSdkCall>['fullStream']>;

const chatAiSdkAgentStream = RIVER_STREAMS.createRiverStream(
	'chat-ai-sdk-agent',
	RIVER_STREAMS.riverStorageDefaultProvider<ChatAiSdkChunkType>()
);

export const chatAiSdkAgent = RIVER_AGENTS.createRiverAgent({
	inputSchema: z.array(
		z.object({
			role: z.enum(['user', 'assistant', 'system']),
			content: z.string()
		})
	),
	stream: chatAiSdkAgentStream,
	runner: async (args) => {
		const { input, abortSignal, stream } = args;

		const { fullStream } = chatAiSdkCall(input, abortSignal);

		for await (const chunk of fullStream) {
			stream.appendChunk(chunk);
		}
	}
});

// EXAMPLE AI SDK AGENT

type ExampleAiSdkChunkType = InferAiSdkChunkType<ReturnType<typeof demoAiStream>>;

const exampleAiSdkAgentStream = RIVER_STREAMS.createRiverStream(
	'example-ai-sdk-agent',
	RIVER_STREAMS.riverStorageDefaultProvider<ExampleAiSdkChunkType>()
);

export const exampleAiSdkAgent = RIVER_AGENTS.createRiverAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	stream: exampleAiSdkAgentStream,
	runner: async (args) => {
		const { input, abortSignal, stream } = args;

		const fullStream = demoAiStream(input.prompt, abortSignal);

		for await (const chunk of fullStream) {
			stream.appendChunk(chunk);
		}
	}
});

// EXAMPLE CUSTOM AGENT

type ExampleCustomChunkType = {
	character: string;
	index: number;
};

const exampleCustomAgentStream = RIVER_STREAMS.createRiverStream(
	'example-custom-agent',
	RIVER_STREAMS.riverStorageDefaultProvider<ExampleCustomChunkType>()
);

export const exampleCustomAgent = RIVER_AGENTS.createRiverAgent({
	inputSchema: z.object({
		yourName: z.string()
	}),
	stream: exampleCustomAgentStream,
	runner: async (args) => {
		const { input, abortSignal, stream } = args;

		const characters = input.yourName.split('');
		let index = 0;
		while (index < characters.length && !abortSignal.aborted) {
			// yea i vibe coded this regex fight me
			if (/^[a-zA-Z]$/.test(characters[index])) {
				stream.appendChunk({ character: characters[index], index });
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			index++;
		}
	}
});
