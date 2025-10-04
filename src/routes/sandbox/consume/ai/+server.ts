import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, tool, type StreamTextResult, type TextStreamPart, type ToolSet } from 'ai';
import z from 'zod';

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

const amongTool = tool({
	name: 'imposterCheck',
	description: 'Check if the user is an imposter',
	inputSchema: z.object({
		userId: z.string()
	}),
	execute: async ({ userId }) => {
		return {
			imposterStatus: Math.random() > 0.5 ? 'imposter' : 'not imposter'
		};
	}
});

const getAiStream = () => {
	const prompt = 'Is the earth flat?';

	return streamText({
		model: openrouter('x-ai/grok-4-fast:free', {
			reasoning: {
				enabled: true,
				effort: 'medium'
			}
		}),
		tools: {
			imposterCheck: amongTool
		},
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	});
};

type InferAiSdkTools<T> = T extends StreamTextResult<infer Tools, never> ? Tools : never;

type InferTextStreamChunkPart<T> = TextStreamPart<InferAiSdkTools<T>>;

type StreamChunk = InferTextStreamChunkPart<ReturnType<typeof getAiStream>>;

type AiSdkRiverStream<T extends ToolSet> = {
	endpoint: string;
	agent: StreamTextResult<T, never>;
};

type CreateAiSdkRiverStream = <T extends ToolSet>(args: {
	agent: StreamTextResult<T, never>;
	endpoint: string;
}) => AiSdkRiverStream<T>;

const createAiSdkRiverStream: CreateAiSdkRiverStream = ({ agent, endpoint }) => {
	return {
		agent,
		endpoint
	};
};

// this is neat, but do not need it at all lol
// type InferAiSdkChunkFromTools<T extends ToolSet> = Awaited<
// 	ReturnType<ReturnType<StreamTextResult<T, never>['fullStream']['getReader']>['read']>
// >['value'];

// neat this works!
// const lad = 'bill' as unknown as StreamChunk;
// if (lad.type === 'tool-call' && !lad.dynamic) {
// 	console.log(lad.toolName);
// }

// TODO:
// there is a lot to think about with this. tbh I think just getting better typesafety out of the AI sdk could do really well. The way it works right now is awesome for generic streams, which can be useful, but for the AI sdk it's probably a little weird and not needed. I think I keep the current streams pattern for custom streams, and then make a special one just for the AI sdk. It will not need zod or anything, just need to pass in the types from stream text and then make a client consumer that does not use zod, just types.
type BrothermanBill = ReturnType<typeof getAiStream>;

export const GET = async () => {
	const { fullStream } = getAiStream();
	const reader = fullStream.getReader();

	const { value, done } = await fullStream.getReader().read();

	if (done) {
		return new Response(null, { status: 200 });
	}

	if (value.type === 'tool-call') {
		value;
		if (value.dynamic) {
			value;
		} else {
			value.toolName;
		}
	}
	return new Response();
};
