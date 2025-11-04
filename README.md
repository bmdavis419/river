# river - 0.3.0

_an experiment by <a href="https://davis7.sh" target="_blank">ben davis</a> that went WAY too far..._

> [!WARNING]
> This project is very much not abandoned, I've just been traveling too much. A half working version of redis durable streams was just pushed, but this definitely needs to be cleaned up a ton (same with the default & s2 providers tbh). Roadmap below...

## it's TRPC, but for agents/streams...

```svelte
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';

	// ALL of this is type safe, feels just like TRPC
	const { start, stop, status } = myRiverClient.basicExample({
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

## R O A D M A P

_everything i want to do with this project, goal is to have this shipped with a usable beta by the end of november_

0. get a set of stable api's for v1

i'm pretty confident with the user facing stuff right now, but i think one more pass is worth it before i go through the slog below

- deeper builder pattern for the agents (create => input => provider => runner). this is gonna make it so you have to put the chunk type outside of the runner which sucks, but the current setup is so damn weird that i think it's worth that tradeoff
- cleanup provider interface
- finalize client interface
- iron out abort vs cancel logic
- error handling polishing

1. monorepo migration

this sveltekit project served me well for just screwing around and trying things out, but i will absolutely need a real monorepo if I'm going to make this work long term. the good news is i for some reason figured out how to do that recently: https://github.com/bmdavis419/r8y-v3

- river core package (router and agents builder)
- framework packages (server and client stuff) for tanstack start and sveltekit
- provider packages (for stream resuming and durability)

2. mentioned above, but tanstack start support

3. real documentation site & homepage & good cursor rules & good out of the box prompt to add this to your projects

4. "real world" examples OSS'd

_eventually want to do_

- react native + expo support

## what you get

- full type safety
- rpc-like function calling
- trpc mutation like interface for consuming the streams
- ai sdk streaming support **with full stack type safety**
- custom stream support **with zod validation on chunks**

this project does actually work right now, but it is very early in development and NOT recommended for production use. **it is in alpha, the apis will change a lot...**

## getting started using the package

if you want to try this out, it's now available on [npm](https://www.npmjs.com/package/@davis7dotsh/river-alpha)!

here are a couple of examples, they're both are fully type safe, are pleasant to work in, and work great: <a href="https://github.com/bmdavis419/river-examples" target="_blank">check them out</a>

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
import { myRiverRouter } from '$lib/river/router';
import { RIVER_SERVERS } from '@davis7dotsh/river-alpha';

export const { POST, GET } = RIVER_SERVERS.createSvelteKitEndpointHandler({
	streams: myRiverRouter
});
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
