# river

_an experiment by [ben davis](https://davis7.sh) that went WAY too far..._

## it's TRPC, but for agents/streams...

```svelte
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';

	// ALL of this is type safe, feels just like TRPC
	const { start, stop } = myRiverClient.basicExample({
		onStart: () => {
			console.log('Starting basic example');
		},
		onChunk: (chunk) => {
			// full type safety on the chunks
		},
		onCancel: () => {
			console.log('You cancelled the basic example');
		},
		onError: (error) => {
			console.error('Error in basic example', error);
		},
		onComplete: ({ totalChunks, duration }) => {
			console.log(`Basic example completed in ${duration}ms with ${totalChunks} chunks`);
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
- react query like interface for consuming the streams
- ai sdk streaming support **with full stack type safety**
- custom stream support **with zod validation on chunks**

this project does actually work right now, but it is very early in development and NOT recommended for production use. **it is in alpha, the apis will change a lot...**

## local package dev setup

1. get an openrouter api key
2. add it to your `.env.local` file (see `.env.example`)
3. `bun i`
4. `bun dev`

## getting started using the package

if you want to try this out, it's now available on npm!

I've built out two examples, one using the ai-sdk and one using a custom stream. both are fully type safe and work great. You can find them [here](https://github.com/bmdavis419/river-examples)

**here's a quick getting started guide for custom streams**

1. install dependencies

```bash
bun i @davis7dotsh/river-alpha zod
```

2. setup your first agent (this looks slightly different for the [ai-sdk agents](https://github.com/bmdavis419/river-examples/blob/main/basic-aisdk-example/src/lib/river/agents.ts))

```ts
// src/lib/river/agents.ts
import { RIVER_SERVER } from '@davis7dotsh/river-alpha';
import { z } from 'zod';

export const basicExampleAgent = RIVER_SERVER.createCustomAgent({
	inputSchema: z.object({
		message: z.string()
	}),
	streamChunkSchema: z.object({
		letter: z.string(),
		isVowel: z.boolean()
	}),
	// a stream will automatically be created for you when you call this agent
	// first param is the input, second param is a function to append chunks to the stream
	// the stream will close when the agent returns
	agent: async ({ message }, appendChunk) => {
		const letters = message.split('');
		const onlyLetters = letters.filter((letter) => /^[a-zA-Z]$/.test(letter));
		for (let i = 0; i < onlyLetters.length; i++) {
			const letter = onlyLetters[i];
			const isVowel = /^[aeiou]$/i.test(letter);
			appendChunk({ letter, isVowel });
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	}
});
```

3. setup your router

```ts
// src/lib/river/router.ts
import { RIVER_SERVER } from '@davis7dotsh/river-alpha';
import { basicExampleAgent } from './agents';

export const myRiverRouter = RIVER_SERVER.createAgentRouter({
	// I recommend having the key not be the name of the agent, this will make the go to definition experience much better
	basicExample: basicExampleAgent
});

// this is to get type inference on the client
export type MyRiverRouter = typeof myRiverRouter;
```

4. setup the endpoint

```ts
// src/routes/api/river/+server.ts
import { myRiverRouter } from '$lib/river/router';
import { RIVER_SERVER } from '@davis7dotsh/river-alpha';

// this is all it takes, nothing else needed
// NOTE: this is sveltekit specific, more frameworks coming eventually...
export const { POST } = RIVER_SERVER.createServerEndpointHandler(myRiverRouter);
```

5. setup the client

```ts
// src/lib/river/client.ts
import { RIVER_CLIENT } from '@davis7dotsh/river-alpha';
import type { MyRiverRouter } from './router';

// similar to a trpc client, this is how we call the agents from the client
export const myRiverClient = RIVER_CLIENT.createClientCaller<MyRiverRouter>('/api/river');
```

6. use your agent on the client with a client side caller

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';

	// this works just like mutations in trpc, it will not actually run until you call start
	// the callbacks are optional, and will fire when they are defined and the agent starts
	const basicExampleCaller = myRiverClient.basicExample({
		onStart: () => {
			// fires when the agent starts
			console.log('Starting basic example');
		},
		onChunk: ({ letter, isVowel }) => {
			// fires when a chunk is received
			// will always just have one chunk and is fully type safe
			console.log(`${letter} is ${isVowel ? 'a vowel' : 'a consonant'}`);
		},
		onCancel: () => {
			// fires when the agent is cancelled/stopped
			console.log('You cancelled the basic example');
		},
		onError: (error) => {
			// fires when the agent errors
			console.error('Error in basic example', error);
		},
		onComplete: ({ totalChunks, duration }) => {
			// fires when the agent completes
			// this will ALWAYS fire last, even if the agent was cancelled or errored
			console.log(`Basic example completed in ${duration}ms with ${totalChunks} chunks`);
		}
	});

	const handleStart = async () => {
		// actually starts the agent
		await basicExampleCaller.start({
			message: 'This is in fact a message'
		});
	};

	const handleCancel = () => {
		// stops the agent (uses an abort controller under the hood)
		basicExampleCaller.stop();
	};
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

- better abort controller support in ai-sdk agents. need to be able to pass a signal into the agent
- "beforeAgentRun" hooks on the server for both types of agents. will give you access to the request event so you can do stuff like auth checks, pull things out of DB, etc...
- stream resumability support. need to figure out a good way to dump the stream to a persistent store so we can easily resume later **will require api changes**
- "waitUntil" support. this pretty much goes hand and hand with stream resumability

## docs for: `0.0.2`

_see the examples for more detailed usage, these api's will change..._

### core primitives

1. **agents**: these come in two flavors, `AiSdkAgent` and `CustomAgent`. The ai-sdk agent is for when you want to use the `streamText` function from the `ai` package. The custom agent is for when you want to do custom stuff and just need a type safe stream (validated with zod)
2. **agent router**: the is the thing you create on the server which will allow you to call agents. VERY similar to a TRPC router.
3. **agent caller**: this is the client side primitive for actually calling agents. It's fully type safe (grabs types from the router) and feels like react query.
4. **endpoint handler**: this is something you will basically never touch. it's just a function that returns a POST handler for actually processing your requests

### helper types

these are a few helper types I made that really help with getting good type safety in your clients. the names are a bit verbose, but at least they're descriptive...

- `RiverClientCallerAiSdkToolSetType<T>` takes in a client caller and returns the full tool set type for that agent

```ts
type AiSdkAgentToolSet = RiverClientCallerAiSdkToolSetType<typeof riverClient.exampleAiSdkAgent>;
```

- `RiverClientCallerToolCallInputType<T, K extends string>` takes in a tool set types (can get with the above type) and a tool name and returns the input type for that tool

```ts
type ImposterToolCallInputType = RiverClientCallerToolCallInputType<
	AiSdkAgentToolSet,
	'imposterCheck'
>;
```

- `RiverClientCallerToolCallOutputType<T, K extends string>` takes in a tool set types (can get with the above type) and a tool name and returns the output type for that tool

```ts
type ImposterToolCallOutputType = RiverClientCallerToolCallOutputType<
	AiSdkAgentToolSet,
	'imposterCheck'
>;
```

- `RiverClientCallerChunkType<T>` takes in a client caller and returns the full chunk type for that agent

```ts
type AiSdkAgentChunk = RiverClientCallerChunkType<typeof riverClient.exampleAiSdkAgent>;
```

- `RiverClientCallerInputType<T>` takes in a client caller and returns the full input type for that agent

```ts
type AiSdkAgentInputType = RiverClientCallerInputType<typeof riverClient.exampleAiSdkAgent>;
```

if you have feedback or want to contribute, don't hesitate. best place to reach out is on my twitter [@bmdavis419](https://x.com/@bmdavis419)
