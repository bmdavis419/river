# river

_an experiment by [ben davis](https://davis7.sh) that went WAY too far..._

## it's TRPC, but for agents/streams...

this all actually works! try it out in `src/routes/examples` (getting started guide below)

1. create the agent:

```ts
export const exampleAiSdkAgent = RIVER_SERVER.createAiSdkAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	agent: ({ prompt }) => {
		return streamText({
			model: openai('gpt-5-mini'),
			prompt
		});
	}
});
```

2. create the router:

```ts
export const exampleRouter = RIVER_SERVER.createAgentRouter({
	exampleAiSdkAgent
});

export type ExampleRouter = typeof exampleRouter;
```

3. create the endpoint:

```ts
export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter);
```

4. create the client side caller:

```ts
export const riverClient = RIVER_CLIENT.createClientCaller<ExampleRouter>('/examples/river');
```

5. consume the agent:

```ts
const { start, stop } = riverClient.agent('exampleAiSdkAgent').makeCaller({
	onStart: () => {},
	onChunk: (chunk) => {
		// type safe AI SDK stream chunk
	},
	onComplete: (data) => {},
	onError: (error) => {},
	onCancel: () => {}
});
```

## what you get

- full type safety
- rpc-like function calling
- react query like interface for consuming the streams
- ai sdk streaming support **with full stack type safety**
- custom stream support **with zod validation on chunks**

this project does actually work right now, but it is very early in development and NOT recommended for production use. **it is in alpha, the apis will change a lot...**

## local dev setup

1. get an openrouter api key
2. add it to your `.env.local` file (see `.env.example`)
3. `bun i`
4. `bun dev`

## project info

### why make this?

- streams went from something you touch every once and a while, to something we're using all the time
- i want typesafety
- i like react query patterns, I want them for everything
- streams are verbose and gross out of the box
- _i want a company to steal this_

### examples that currently work

_the actual logic and important bits were fully written by me and are good and work, but the ui is vibe coded garbage. it's just an example they'll be better later_

- `src/routes/examples/basic`
- `src/routes/examples/kitchenSink`
- `src/routes/examples/chat`

### THINGS I WANT TO IMPROVE

- instead of function calls on the client, have the TRPC style objects so I can get the good go to definition experience
- good utility types for grabbing agent input types and agent chunk types on the client from the callers

### FEATURES I WANT TO ADD

- stream resumability support. need to figure out a good way to dump the stream to a persistent store so we can easily resume later **will require api changes**
- "waitUntil" support. this pretty much goes hand and hand with stream resumability

## docs for: `alpha.1`

_i will fix the versioning before this actually releases, again DON'T ACTUALLY USE THIS YET_

### core primitives

1. **agents**: these come in two flavors, `AiSdkAgent` and `CustomAgent`. The ai-sdk agent is for when you want to use the `streamText` function from the `ai` package. The custom agent is for when you want to do custom stuff and just need a type safe stream (validated with zod)
2. **agent router**: the is the thing you create on the server which will allow you to call agents. VERY similar to a TRPC router.
3. **agent caller**: this is the client side primitive for actually calling agents. It's fully type safe (grabs types from the router) and feels like react query.
4. **endpoint handler**: this is something you will basically never touch. it's just a function that returns a POST handler for actually processing your requests

### the key apis

1. `RIVER_SERVER.createAiSdkAgent`
   this is how you create an agent that uses the ai-sdk. works kinda like a TRPC procedure, except for this one you return a stream from `streamText()`

_full example on `src/routes/examples/river/agents.ts`_

```ts
export const exampleAiSdkAgent = RIVER_SERVER.createAiSdkAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	agent: ({ prompt }) => {
		// demoAiStream is a function that returns the result of streamText()
		return demoAiStream(prompt);
	}
});
```

2. `RIVER_SERVER.createCustomAgent`
   this is how you create an agent that uses a custom stream. works kinda like a TRPC procedure, except for this one you have an async function where you get an append method to send stuff to the stream

_full example on `src/routes/examples/river/agents.ts`_

```ts
export const exampleCustomAgent = RIVER_SERVER.createCustomAgent({
	inputSchema: z.object({
		yourName: z.string()
	}),
	streamChunkSchema: z.object({
		character: z.string(),
		index: z.number()
	}),
	agent: async ({ yourName }, append) => {
		const characters = yourName.split('');
		let index = 0;
		for (const character of characters) {
			append({ character, index });
			index++;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}
});
```

3. `RIVER_SERVER.createAgentRouter`
   this is how you create an agent router. works kinda like a TRPC router.

_full example on `src/routes/examples/river/router.ts`_

```ts
export const exampleRouter = RIVER_SERVER.createAgentRouter({
	exampleAiSdkAgent,
	exampleCustomAgent
});

export type ExampleRouter = typeof exampleRouter;
```

4. `RIVER_SERVER.createServerEndpointHandler`
   takes in your router and returns a POST when you can just dump in a `+server.ts` file

_full example on `src/routes/examples/river/+server.ts`_

```ts
export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter);
```

5. `RIVER_CLIENT.createClientCaller`
   this is how you create a client caller, similar to the trpc client

_full example on `src/routes/examples/river/client.ts`_

```ts
export const riverClient = RIVER_CLIENT.createClientCaller<ExampleRouter>('/examples/river');
```

6. `riverClient.agent('AGENT_NAME').makeCaller()`
   this one is definitely gonna get changed. it works kinda like how trpc does, but instead of object calls it uses function calls. this was easier for an early version, but you loose important stuff like go to definition. the agent isn't called until you call `start()`, can be cancelled with `stop()`, and has life cycle events for everything you might want.

```ts
const { start, stop } = riverClient.agent('exampleCustomAgent').makeCaller({
	onStart: () => {},
	onChunk: (chunk) => {},
	onComplete: (data) => {},
	onError: (error) => {},
	onCancel: () => {}
});
```

if you have feedback or want to contribute, don't hesitate. best place to reach out is on my twitter [@bmdavis419](https://x.com/@bmdavis419)
