# river

_an experiment by <a href="https://davis7.sh" target="_blank">ben davis</a> that went WAY too far..._

## it's TRPC, but for agents/streams...

```svelte
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';

	// ALL of this is type safe, feels just like TRPC
	const { start, stop, resume } = myRiverClient.aRiverStream({
		onChunk: (chunk) => {
			// fully type safe!
			console.log(chunk)
		},
		onStart: () => {
			allChunks = [];
		},
		onEnd: () => {
			console.log("stream ended")
		},
		onError: (error) => {
			console.error(error);
		},
		onAbort: () => {
			console.log('Aborted stream');
		},
		onStreamInfo: ({ encodedResumptionToken }) => {
			console.log("resume with:", encodedResumptionToken)
		}
	});
</script>
```

this project is in active development. not yet recommended for production use, but getting there pretty fast...

## sveltekit getting started

_guide for a fully resumable stream in sveltekit_

you can see the full demo [here](https://github.com/bmdavis419/redis-river-demo)

0. init a sveltekit project (select: minimal, typescript, prettier, tailwindcss, and then typography)

```bash
bunx sv create river-demo
```

1. install the dependencies

```
bun add @davis7dotsh/river-core@latest @davis7dotsh/river-adapter-sveltekit@latest @davis7dotsh/river-provider-redis@latest
```

_peer dependencies you also need to install:_

```bash
bun add zod ioredis neverthrow
```

_dependencies for this demo:_

```bash
bun add runed ai @openrouter/ai-sdk-provider marked
bun add -d svelte-adapter-bun
bun remove @sveltejs/adapter-auto
```

2. add env vars (you will need a redis db and an openrouter api key)

```.env.local
# railway & upstash are great options
REDIS_URL=redis://localhost:6379

# google open router u will find it
OPENROUTER_API_KEY=your-openrouter-api-key
```

3. setup the sveltekit project

```package.json
	"scripts": {
		"dev": " bunx --bun vite dev",
		"build": "bunx --bun vite build",
		"preview": "bunx --bun vite preview",
		"start": "bun run ./build",
		"prepare": "svelte-kit sync || echo ''",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
		"format": "prettier --write .",
		"lint": "prettier --check ."
	},
```

```svelte.config.js
import adapter from 'svelte-adapter-bun';
```

4. start the dev server

```bash
bun dev
```

5. create a redis instance

```ts
// src/lib/db/index.ts
import Redis from 'ioredis';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

const globalForDb = globalThis as unknown as {
	redisClient: Redis | undefined;
};

const getClient = () => {
	if (building) {
		throw new Error('Cannot access database during build');
	}

	if (!globalForDb.redisClient) {
		globalForDb.redisClient = new Redis(env.REDIS_URL);
	}

	return globalForDb.redisClient;
};

export const redisClient = new Proxy({} as Redis, {
	get: (_, prop) => {
		const client = getClient();
		return client[prop as keyof Redis];
	}
});
```

6. create a river stream

```ts
// src/lib/river/streams.ts
import { redisClient } from '$lib/db';
import { createRiverStream } from '@davis7dotsh/river-core';
import { redisProvider } from '@davis7dotsh/river-provider-redis';
import { streamText, tool, type AsyncIterableStream } from 'ai';
import z from 'zod';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '$env/dynamic/private';

const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY
});

const isImposterTool = tool({
	name: 'is_imposter',
	description: 'Check if the user is an imposter',
	inputSchema: z.object({
		username: z.string()
	}),
	execute: async () => {
		// imagine we did something with the username and got a result
		const randomNumber = Math.random();
		if (randomNumber < 0.5) {
			return {
				isImposter: true
			};
		}
		return {
			isImposter: false
		};
	}
});

const unreliableAgent = (question: string) => {
	const { fullStream } = streamText({
		model: openrouter('anthropic/claude-haiku-4.5'),
		prompt: question,
		tools: {
			isImposterTool
		},
		stopWhen: stepCountIs(5),
		system: `You are an agent who's job is to answer whatever question a user may have. The trick is that they may be an imposter and you need to check if they are before answering the question. If they are an imposter, don't tell them you know, just give them an answer that is the direct opposite of the truth.

			Here is the user's username: user_1234258sd`
	});

	return fullStream;
};

type ExtractAiSdkChunkType<T> = T extends AsyncIterableStream<infer U> ? U : never;

type ChunkType = ExtractAiSdkChunkType<ReturnType<typeof unreliableAgent>>;

export const unreliableAgentStream = createRiverStream<ChunkType>()
	.input(
		z.object({
			question: z.string()
		})
	)
	.provider(
		redisProvider({
			streamStorageId: 'unreliable-agent',
			redisClient,
			waitUntil: (promise) => {
				promise.then(() => {
					console.log('stream completed');
				});
			}
		})
	)
	.runner(async ({ input, stream }) => {
		const { appendChunk, close } = stream;

		const agentStream = unreliableAgent(input.question);

		for await (const chunk of agentStream) {
			appendChunk(chunk);
		}

		await close();
	});
```

7. create a river router

```ts
// src/lib/river/router.ts
import { createRiverRouter } from '@davis7dotsh/river-core';
import { unreliableAgentStream } from './streams';

export const myRiverRouter = createRiverRouter({
	unreliableAgent: unreliableAgentStream
});

export type MyRiverRouter = typeof myRiverRouter;
```

8. create the endpoint handler

```ts
// src/routes/api/river/+server.ts
import { myRiverRouter } from '$lib/river/router';
import { riverEndpointHandler } from '@davis7dotsh/river-adapter-sveltekit';

export const { GET, POST } = riverEndpointHandler(myRiverRouter);
```

9. create the river client

```ts
import { createRiverClient } from '@davis7dotsh/river-adapter-sveltekit';
import type { MyRiverRouter } from './router';

export const myRiverClient = createRiverClient<MyRiverRouter>('/api/river');
```

10. create the page to consume the river stream and update the global styles to feel a bit nicer

```css
/* src/app.css */
@import 'tailwindcss';
@plugin '@tailwindcss/typography';

body {
	@apply bg-neutral-900 text-neutral-50;
}
```

```svelte
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';
	import { marked } from 'marked';
	import { useSearchParams } from 'runed/kit';
	import { onMount } from 'svelte';
	import z from 'zod';

	const searchParamsSchema = z.object({
		resumeKey: z.string().default('')
	});

	const params = useSearchParams(searchParamsSchema);

	const resumeKey = $derived(params.resumeKey);

	let question = $state('Is the earth really flat?');
	const trimmedQuestion = $derived(question.trim());

	let answer = $state('');
	const parsedAnswer = $derived(marked(answer, { async: false }));
	let wasImposer = $state<boolean | undefined>(undefined);

	const agentCaller = myRiverClient.unreliableAgent({
		onChunk: (chunk) => {
			if (chunk.type === 'text-delta') {
				answer += chunk.text;
			} else if (chunk.type === 'tool-result') {
				if (!chunk.dynamic) {
					wasImposer = chunk.output.isImposter;
				}
			}
		},
		onStart: () => {
			console.log('starting stream');
			answer = '';
			wasImposer = false;
		},
		onEnd: () => {
			console.log('stream ended');
		},
		onError: (error) => {
			console.error('stream error', error);
		},
		onStreamInfo: (info) => {
			if (info.encodedResumptionToken) {
				params.resumeKey = info.encodedResumptionToken;
			}
		}
	});

	onMount(() => {
		if (resumeKey) {
			agentCaller.resume(resumeKey);
		}
	});

	const status = $derived(agentCaller.status);

	const handleAsk = () => {
		if (!trimmedQuestion) return;
		agentCaller.start({
			question: trimmedQuestion
		});
	};

	const handleClear = () => {
		answer = '';
		wasImposer = undefined;
		params.resumeKey = '';
	};
</script>

<div class="mx-auto flex max-w-4xl flex-col gap-4 p-6">
	<textarea
		bind:value={question}
		placeholder="Enter your question..."
		class="min-h-[200px] w-full resize-none rounded-lg border border-gray-300 p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
	></textarea>

	<div class="text-sm text-gray-500">{status}</div>

	<div class="mt-4 flex gap-4">
		<button
			onclick={handleAsk}
			class="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			Ask
		</button>
		<button
			onclick={handleClear}
			class="rounded-lg bg-gray-600 px-6 py-2 text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:outline-none"
		>
			Clear Answer
		</button>
	</div>

	{#if status === 'running' && wasImposer === undefined && !parsedAnswer}
		<div class="text-sm text-gray-500">Thinking...</div>
	{/if}

	{#if parsedAnswer}
		<div>
			{#if wasImposer}
				<div class="text-red-500">
					<p>You are an imposter!</p>
				</div>
			{:else}
				<div class="text-green-500">
					<p>You are not an imposter!</p>
				</div>
			{/if}
		</div>
		<div class="mt-4">
			<div class="prose max-w-none prose-invert">{@html parsedAnswer}</div>
		</div>
	{/if}
</div>
```

## server side caller

you can also run a river stream server side either in the background (requires provider that supports resuming) or synchronously

**create a server side caller**

```ts
// src/lib/river/serverCaller.ts
import { createServerSideCaller } from '@davis7dotsh/river-core';
import { myRiverRouter } from './router';

export const myServerCaller = createServerSideCaller(myRiverRouter);
```

** run in the background **

```ts
// src/lib/demo.remote.ts
import { command, getRequestEvent } from '$app/server';
import z from 'zod';
import { myServerCaller } from './river/serverCaller';
import { error } from '@sveltejs/kit';

export const remoteStartUnreliableStreamInBg = command(
	z.object({
		prompt: z.string()
	}),
	async ({ prompt }) => {
		const event = getRequestEvent();
		const bgStartResult = await myServerCaller.redisResume.startStreamInBackground({
			input: {
				prompt
			},
			adapterRequest: {
				event
			}
		});

		if (bgStartResult.isErr()) {
			console.error(bgStartResult.error);
			return error(500, bgStartResult.error);
		}

		return {
			resumeKey: bgStartResult.value.encodedResumptionToken
		};
	}
);
```

** resume a stream on the server **

```ts
// src/lib/demo.remote.ts
import { command, getRequestEvent } from '$app/server';
import z from 'zod';
import { myServerCaller } from './river/serverCaller';
import { error } from '@sveltejs/kit';

export const remoteResumeUnreliableStream = command(
	z.object({
		resumeKey: z.string()
	}),
	async ({ resumeKey }) => {
		const streamResult = await myServerCaller.redisResume.resumeStream({
			resumeKey
		});

		if (streamResult.isErr()) {
			console.error(streamResult.error);
			return error(500, streamResult.error);
		}

		let totalLetters = 0;
		let totalVowels = 0;

		for await (const chunk of streamResult.value) {
			if (chunk.type === 'chunk') {
				if (chunk.chunk.isVowel) {
					totalVowels++;
				}
				totalLetters++;
			}
			if (chunk.type === 'special') {
				console.log('got special chunk', chunk.special);
			}
		}

		return {
			totalLetters,
			totalVowels
		};
	}
);
```

** run synchronously **

```ts
// src/lib/demo.remote.ts
import { command, getRequestEvent } from '$app/server';
import z from 'zod';
import { myServerCaller } from './river/serverCaller';
import { error } from '@sveltejs/kit';

export const remoteRunUnreliableStream = command(
	z.object({
		prompt: z.string()
	}),
	async ({ prompt }) => {
		const event = getRequestEvent();
		const streamResult = await myServerCaller.redisResume.startStreamAndConsume({
			input: {
				prompt
			},
			adapterRequest: {
				event
			}
		});

		if (streamResult.isErr()) {
			console.error(streamResult.error);
			return error(500, streamResult.error);
		}

		const stream = streamResult.value;
		let totalLetters = 0;
		let resumeKey: string | null = null;
		let totalVowels = 0;

		for await (const chunk of stream) {
			if (chunk.type === 'special') {
				if (chunk.special.RIVER_SPECIAL_TYPE_KEY === 'stream_start') {
					resumeKey = chunk.special.encodedResumptionToken ?? null;
				}
			}
			if (chunk.type === 'chunk') {
				if (chunk.chunk.isVowel) {
					totalVowels++;
				}
				totalLetters++;
			}
		}

		return {
			totalVowels,
			totalLetters,
			resumeKey
		};
	}
);
```

## roadmap:

1. make the docs actually real & useful:
   - pages for each piece of the library with good examples
   - automatic setup with llm prompts (copy into cursor agent and get river working in seconds)
2. really good cursor rules for river
3. tanstack start adapter for river
4. s2 provider for river
5. more complex real world examples for river
