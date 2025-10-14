# river - 0.2.0

_an experiment by <a href="https://davis7.sh" target="_blank">ben davis</a> that went WAY too far..._

> [!WARNING]
> As I said, this is alpha software that's gonna change. This is a new version from the original with almost entirely new api's. Expect this to happen again in 0.3.0...

## it's TRPC, but for agents/streams...

```svelte
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';

	// ALL of this is type safe, feels just like TRPC
	const { start, stop } = myRiverClient.basicExample({
		onStart: () => {
			console.log('starting basic example');
		},
		onChunk: (chunk) => {
			// full type safety on the chunks
			console.log(chunk);
		},
		onError: (error) => {
			console.error(error);
		},
		onSuccess: () => {
			console.log('Success');
		},
		onCancel: () => {
			console.log('Canceled');
		},
		onStreamInfo: (streamInfo) => {
			console.log(streamInfo);
		}
	});
</script>
```

```bash
bun i @davis7dotsh/river-alpha
```

**this is alpha software, use it at your own risk. api's will change, bugs will be fixed, features will be added, etc...**

## what you get

- full type safety
- rpc-like function calling
- trpc mutation like interface for consuming the streams
- ai sdk streaming support **with full stack type safety**
- custom stream support **with zod validation on chunks**

this project does actually work right now, but it is very early in development and NOT recommended for production use. **it is in alpha, the apis will change a lot...**

## local package dev setup

1. get an openrouter api key
2. add it to your `.env.local` file (see `.env.example`)
3. `bun i`
4. `bun dev`

## getting started using the package

if you want to try this out, it's now available on [npm](https://www.npmjs.com/package/@davis7dotsh/river-alpha)!

i've built out two examples, one using the ai-sdk and one using a custom stream.

they're both are fully type safe, are pleasant to work in, and work great: <a href="https://github.com/bmdavis419/river-examples" target="_blank">check them out</a>

### here's a quick getting started guide for custom streams

0. create a new sveltekit project (if you don't have one already)

```bash
bunx sv create river-demo
```

1. install dependencies

```bash
bun i @davis7dotsh/river-alpha zod
```

2. setup your first stream

```ts
// src/lib/river/streams.ts
import { RIVER_STREAMS } from '@davis7dotsh/river-alpha';
import { z } from 'zod';

export const myFirstNewRiverStream = RIVER_STREAMS.createRiverStream()
	.input(
		z.object({
			yourName: z.string()
		})
	)
	.runner(async (stuff) => {
		const { input, initStream, abortSignal } = stuff;

		const activeStream = await initStream(
			// this is where the type safety happens, the generic type is the chunk type
			RIVER_PROVIDERS.defaultRiverStorageProvider<{
				isVowel: boolean;
				letter: string;
			}>()
		);

		const { yourName } = input;

		activeStream.sendData(async ({ appendChunk, close }) => {
			const letters = yourName.split('');
			const onlyLetters = letters.filter((letter) => letter.match(/[a-zA-Z]/));
			for await (const letter of onlyLetters) {
				if (abortSignal.aborted) {
					break;
				}
				appendChunk({ isVowel: !!letter.match(/[aeiou]/i), letter });
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			close();
		});

		return activeStream;
	});
```

3. setup your router

```ts
// src/lib/river/router.ts
import { RIVER_STREAMS } from '$lib/river/streams.js';
import { myFirstNewRiverStream } from './streams.js';

export const myFirstRiverRouter = RIVER_STREAMS.createRiverRouter({
	vowelCounter: myFirstNewRiverStream
});

export type MyFirstRiverRouter = typeof myFirstRiverRouter;
```

4. setup the endpoint

```ts
// src/routes/api/river/+server.ts
import { RIVER_SERVERS } from '$lib/river/server.js';
import { myFirstRiverRouter } from './router.js';

export const { POST } = RIVER_SERVERS.createSvelteKitEndpointHandler(myFirstRiverRouter);
```

5. setup the client

```ts
// src/lib/river/client.ts
import { RIVER_CLIENT_SVELTEKIT } from '$lib/index.js';
import type { MyFirstRiverRouter } from './router.js';

export const myFirstRiverClient =
	RIVER_CLIENT_SVELTEKIT.createSvelteKitRiverClient<MyFirstRiverRouter>('/examples');
```

6. use your agent on the client with a client side caller

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { myFirstRiverClient } from '$lib/river/client.js';

	// this works just like mutations in trpc, it will not actually run until you call start
	// the callbacks are optional, and will fire when they are defined and the agent starts
	const { start, stop, status } = myFirstRiverClient.vowelCounter({
		onStart: () => {
			console.log('Starting');
		},
		onChunk: (chunk) => {
			console.log(chunk);
		},
		onError: (error) => {
			console.error(error);
		},
		onSuccess: () => {
			console.log('Success');
		},
		onCancel: () => {
			console.log('Canceled');
		},
		onStreamInfo: (streamInfo) => {
			console.log(streamInfo);
		}
	});
</script>

<!-- some UI to to consume and start the stream -->
```

## project info

### why make this?

- streams went from something you touch every once and a while, to something we're using all the time
- i want typesafety
- mutations are awesome in tanstack query, i want them for streams
- rpc >>>>>>
- streams are a pain to consume out of the box (readers and encoders and raw fetch and type casting and more annoying shit)

### FEATURES TODO/IN PROGRESS

- more robust error handling on both client and server. want to do something similar to trpc's `TRPCError`
- stream resumability support. need to figure out a good way to dump the stream to a persistent store so we can easily resume later **will require api changes**
- "waitUntil" support. this pretty much goes hand and hand with stream resumability

## docs for: `0.2.0`

_see the examples for more detailed usage, these api's will change..._

### helper types

these are a few helper types that really help with getting good type safety in your clients. the names are a bit verbose, but at least they're descriptive...

```ts
// AI SDK SPECIFIC HELPERS (for agents using Vercel AI SDK)

// gets the "tool set" type (a record of tool names to their tool types) for an ai-sdk agent
type AiSdkAgentToolSet = RiverAiSdkToolSet<typeof riverClient.exampleAiSdkAgent>;

// gets the input type for a tool call for an ai-sdk agent. pass in the tool set type and the tool name
type ImposterToolCallInputType = RiverAiSdkToolInputType<AiSdkAgentToolSet, 'imposterCheck'>;

// gets the output type for a tool call for an ai-sdk agent. pass in the tool set type and the tool name
type ImposterToolCallOutputType = RiverAiSdkToolOutputType<AiSdkAgentToolSet, 'imposterCheck'>;

// GENERAL HELPERS (for any agent)

// gets the chunk type for an agent (the thing passed to the onChunk callback)
type AgentChunkType = RiverStreamChunkType<typeof riverClient.exampleAgent>;

// gets the input type for an agent (the thing passed to the start function)
type AgentInputType = RiverStreamInputType<typeof riverClient.exampleAgent>;

// SERVER SIDE HELPERS (for use in your agent definitions)

// infers the chunk type from an AI SDK stream (useful for typing your storage provider)
type AiSdkChunkType = InferAiSdkChunkType<typeof fullStream>;
```

if you have feedback or want to contribute, don't hesitate. best place to reach out is on my twitter <a href="https://x.com/@bmdavis419" target="_blank">@bmdavis419</a>
