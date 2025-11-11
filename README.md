# river

doing ai agent streams the right way is really hard, river makes it easy...

- full stack type safety on stream chunks
- TRPC like client api to easily consume a stream
- TRPC like server api to easily create and write to a stream
- library agnostic, works with ai sdk, mastra, custom streams, or anything you want
- resumable/durable streams work out of the box with the redis provider
- tanstack start and sveltekit are currently supported, more coming soon...

## table of contents

- [examples](#examples)
- [tanstack start getting started](#tanstack-start-getting-started)
- [sveltekit getting started](#sveltekit-getting-started)
- [roadmap](#roadmap)

## sveltekit support

```svelte
<script lang="ts">
	import { myRiverClient } from '$lib/river/client';

	const { start, resume } = myRiverClient.aRiverStream({
		onChunk: (chunk) => {
			// fully type safe!
			console.log('Chunk received', chunk);
		},
		onStart: () => {
			console.log('Starting stream');
		},
		onSuccess: (data) => {
			console.log('Finished first stream', data.totalChunks, data.totalTimeMs);
		},
		onFatalError: (error) => {
			console.error(error);
		},
		onInfo: ({ encodedResumptionToken }) => {
			// you can resume the stream with this token!
			console.log('Resume with:', encodedResumptionToken);
		}
	});
</script>
```

## tanstack start support

```tsx
import { myRiverClient } from '@/lib/river/client';

const DemoComponent = () => {
	const { start, resume } = myRiverClient.aRiverStream({
		onChunk: (chunk) => {
			// fully type safe!
			console.log('Chunk received', chunk);
		},
		onStart: () => {
			console.log('Starting stream');
		},
		onSuccess: (data) => {
			console.log('Finished first stream', data.totalChunks, data.totalTimeMs);
		},
		onFatalError: (error) => {
			console.error(error);
		},
		onInfo: ({ encodedResumptionToken }) => {
			// you can resume the stream with this token!
			console.log('Resume with:', encodedResumptionToken);
		}
	})

	return (...)
}

```

**FULL DOCUMENTATION IS COMING SOON**

for now just use the below getting started guides and check out the examples for more complex usage...

## examples

you can find examples for how to use river in "real world" projects here:

_each one includes guides on running it locally and how to deploy it_

- [sveltekit river demo](https://github.com/bmdavis419/river-sveltekit-demo)
- [tanstack start demo](https://github.com/bmdavis419/river-tanstack-start-demo)

## tanstack start getting started

this is a basic example of a custom stream that will count the number of vowels, consonants, and special characters in a message (it's contrived I know, but hear me out...):

0. init a tanstack start project `bun create @tanstack/start@latest` and then delete basically everything in the routes directory other than the `index.tsx` file and `__root.tsx` file

1. install the dependencies

_river stuff_

```bash
bun add @davis7dotsh/river-core@latest @davis7dotsh/river-adapter-tanstack@latest
```

_peer deps_

```bash
bun add zod neverthrow
```

_start the dev server_

```bash
bun dev
```

2. create a river stream

```ts
// src/lib/river/streams.ts
import type { TanStackStartAdapterRequest } from '@davis7dotsh/river-adapter-tanstack';
import { createRiverStream, defaultRiverProvider } from '@davis7dotsh/river-core';

type ClassifyChunkType = {
	character: string;
	type: 'vowel' | 'consonant' | 'special';
};

export const streamClassifyCharacters = createRiverStream<
	ClassifyChunkType,
	TanStackStartAdapterRequest
>()
	.input(z.object({ message: z.string() }))
	.provider(defaultRiverProvider())
	.runner(async ({ input, stream, abortSignal }) => {
		const { message } = input;
		const { appendChunk, close } = stream;

		const characters = message.split('');

		for (const character of characters) {
			const type = character.match(/[aeiou]/i)
				? 'vowel'
				: character.match(/[bcdfghjklmnpqrstvwxyz]/i)
					? 'consonant'
					: 'special';
			await appendChunk({ character, type });
			await new Promise((resolve) => setTimeout(resolve, 15));
		}

		await close();
	});
```

3. create a river router

```ts
// src/lib/river/router.ts
import { createRiverRouter } from '@davis7dotsh/river-core';
import { streamClassifyCharacters } from './streams';

export const myRiverRouter = createRiverRouter({
	classifyCharacters: streamClassifyCharacters
});

export type MyRiverRouter = typeof myRiverRouter;
```

4. create the endpoint handler

```ts
// src/routes/api/river/index.ts
import { createFileRoute } from '@tanstack/react-router';
import { riverEndpointHandler } from '@davis7dotsh/river-adapter-tanstack';
import { myRiverRouter } from '@/lib/river/router';

const { GET, POST } = riverEndpointHandler(myRiverRouter);

export const Route = createFileRoute('/api/river/')({
	server: {
		handlers: {
			GET,
			POST
		}
	}
});
```

5. create the client caller

```ts
// src/lib/river/client.ts
import { createRiverClient } from '@davis7dotsh/river-adapter-tanstack';
import { MyRiverRouter } from './router';

export const myRiverClient = createRiverClient<MyRiverRouter>('/api/river');
```

6. use your new stream in a component

```tsx
// src/routes/index.tsx
import { myRiverClient } from '@/lib/river/client';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/basic/')({
	component: RouteComponent
});

function RouteComponent() {
	return (
		<div className="min-h-screen flex flex-col p-6">
			<BasicDemo />
		</div>
	);
}

const BasicDemo = () => {
	const [message, setMessage] = useState('Why is TypeScript a better language than Go?');
	const trimmedMessage = message.trim();

	const [vowelCount, setVowelCount] = useState(0);
	const [consonantCount, setConsonantCount] = useState(0);
	const [specialCount, setSpecialCount] = useState(0);

	const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

	const { start } = myRiverClient.classifyCharacters.useStream({
		onStart: () => {
			setStatus('running');
			setVowelCount(0);
			setConsonantCount(0);
			setSpecialCount(0);
		},
		onChunk: (chunk) => {
			switch (chunk.type) {
				case 'vowel':
					setVowelCount((prev) => prev + 1);
					break;
				case 'consonant':
					setConsonantCount((prev) => prev + 1);
					break;
				case 'special':
					setSpecialCount((prev) => prev + 1);
					break;
			}
		},
		onError: (error) => {
			console.warn(error);
		},
		onFatalError: (error) => {
			setStatus('error');
			console.error(error);
		},
		onSuccess: () => {
			setStatus('success');
		}
	});

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		start({ message: trimmedMessage });
	};

	const handleClear = () => {
		setMessage('');
		setVowelCount(0);
		setConsonantCount(0);
		setSpecialCount(0);
		setStatus('idle');
	};

	const hasResults = vowelCount > 0 || consonantCount > 0 || specialCount > 0;
	const hasContent = trimmedMessage.length > 0;
	const showClear = hasResults || hasContent;

	return (
		<>
			<div className="max-w-2xl mx-auto w-full space-y-6 p-6 pt-20">
				<h1 className="text-3xl font-bold text-white mb-6">Character Classifier</h1>

				<div className="grid grid-cols-3 gap-4 mb-6">
					<div className="bg-neutral-800 rounded-lg p-4">
						<div className="text-sm font-medium text-neutral-400 mb-1">Vowels</div>
						<div className="text-3xl font-bold text-white">{vowelCount}</div>
					</div>
					<div className="bg-neutral-800 rounded-lg p-4">
						<div className="text-sm font-medium text-neutral-400 mb-1">Consonants</div>
						<div className="text-3xl font-bold text-white">{consonantCount}</div>
					</div>
					<div className="bg-neutral-800 rounded-lg p-4">
						<div className="text-sm font-medium text-neutral-400 mb-1">Special</div>
						<div className="text-3xl font-bold text-white">{specialCount}</div>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="message" className="block text-sm font-medium text-neutral-300 mb-2">
							Message
						</label>
						<textarea
							id="message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							disabled={status === 'running'}
							rows={4}
							className="w-full px-4 py-3 bg-neutral-800 text-white border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
							placeholder="Enter your message here..."
						/>
					</div>

					<div className="flex gap-3">
						<button
							type="submit"
							disabled={status === 'running' || !trimmedMessage}
							className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{status === 'running' ? 'Processing...' : 'Submit'}
						</button>

						{showClear && status !== 'running' && (
							<button
								type="button"
								onClick={handleClear}
								className="px-4 py-2 bg-neutral-700 text-white rounded-lg font-medium hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-colors"
							>
								Clear
							</button>
						)}
					</div>

					{status === 'error' && (
						<div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
							An error occurred while processing. Please try again.
						</div>
					)}
				</form>
			</div>
		</>
	);
};
```

## sveltekit getting started

this is a basic example of a custom stream that will count the number of vowels, consonants, and special characters in a message (it's contrived I know, but hear me out...):

0. init a new sveltekit project `bunx sv create` (select tailwindcss, prettier, and then anything else you want) make sure you pick minimal and typescript

1. install the dependencies

_river stuff_

```bash
bun add @davis7dotsh/river-core@latest @davis7dotsh/river-adapter-sveltekit@latest
```

_peer deps_

```bash
bun add zod neverthrow
```

_start the dev server_

```bash
bun dev
```

2. create a river stream

```ts
// src/lib/river/streams.ts
import type { SvelteKitAdapterRequest } from '@davis7dotsh/river-adapter-sveltekit';
import { createRiverStream, defaultRiverProvider } from '@davis7dotsh/river-core';

type ClassifyChunkType = {
	character: string;
	type: 'vowel' | 'consonant' | 'special';
};

export const streamClassifyCharacters = createRiverStream<
	ClassifyChunkType,
	SvelteKitAdapterRequest
>()
	.input(z.object({ message: z.string() }))
	.provider(defaultRiverProvider())
	.runner(async ({ input, stream, abortSignal }) => {
		const { message } = input;
		const { appendChunk, close } = stream;

		const characters = message.split('');

		for (const character of characters) {
			const type = character.match(/[aeiou]/i)
				? 'vowel'
				: character.match(/[bcdfghjklmnpqrstvwxyz]/i)
					? 'consonant'
					: 'special';
			await appendChunk({ character, type });
			await new Promise((resolve) => setTimeout(resolve, 15));
		}

		await close();
	});
```

3. create a river router

```ts
// src/lib/river/router.ts
import { createRiverRouter } from '@davis7dotsh/river-core';
import { streamClassifyCharacters } from './streams';

export const myRiverRouter = createRiverRouter({
	classifyCharacters: streamClassifyCharacters
});

export type MyRiverRouter = typeof myRiverRouter;
```

4. create the endpoint handler

```ts
// src/routes/api/river/index.ts
import { riverEndpointHandler } from '@davis7dotsh/river-adapter-sveltekit';
import { myRiverRouter } from '@/lib/river/router';

export const { GET, POST } = riverEndpointHandler(myRiverRouter);
```

5. create the client caller

```ts
// src/lib/river/client.ts
import { createRiverClient } from '@davis7dotsh/river-adapter-sveltekit';
import { MyRiverRouter } from './router';

export const myRiverClient = createRiverClient<MyRiverRouter>('/api/river');
```

6. use your new stream in a component

```svelte
<script lang="ts">
	// src/routes/+page.svelte
	import { myRiverClient } from '$lib/river/client';

	let message = $state('Why is TypeScript a better language than Go?');
	const trimmedMessage = $derived(message.trim());

	let vowelCount = $state(0);
	let consonantCount = $state(0);
	let specialCount = $state(0);

	let status = $state<'idle' | 'running' | 'success' | 'error'>('idle');

	const { start } = myRiverClient.classifyCharacters({
		onStart: () => {
			status = 'running';
			vowelCount = 0;
			consonantCount = 0;
			specialCount = 0;
		},
		onChunk: (chunk) => {
			switch (chunk.type) {
				case 'vowel':
					vowelCount++;
					break;
				case 'consonant':
					consonantCount++;
					break;
				case 'special':
					specialCount++;
					break;
			}
		},
		onError: (error) => {
			console.warn(error);
		},
		onFatalError: (error) => {
			status = 'error';
			console.error(error);
		},
		onSuccess: () => {
			status = 'success';
		}
	});

	const handleSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		start({ message: trimmedMessage });
	};

	const handleClear = () => {
		message = '';
		vowelCount = 0;
		consonantCount = 0;
		specialCount = 0;
		status = 'idle';
	};

	const hasResults = $derived(vowelCount > 0 || consonantCount > 0 || specialCount > 0);
	const hasContent = $derived(trimmedMessage.length > 0);
	const showClear = $derived(hasResults || hasContent);
</script>

<div class="max-w-2xl mx-auto w-full space-y-6 p-6 pt-20">
	<h1 class="text-3xl font-bold text-white mb-6">Character Classifier</h1>

	<div class="grid grid-cols-3 gap-4 mb-6">
		<div class="bg-neutral-800 rounded-lg p-4">
			<div class="text-sm font-medium text-neutral-400 mb-1">Vowels</div>
			<div class="text-3xl font-bold text-white">{vowelCount}</div>
		</div>
		<div class="bg-neutral-800 rounded-lg p-4">
			<div class="text-sm font-medium text-neutral-400 mb-1">Consonants</div>
			<div class="text-3xl font-bold text-white">{consonantCount}</div>
		</div>
		<div class="bg-neutral-800 rounded-lg p-4">
			<div class="text-sm font-medium text-neutral-400 mb-1">Special</div>
			<div class="text-3xl font-bold text-white">{specialCount}</div>
		</div>
	</div>

	<form onsubmit={handleSubmit} class="space-y-4">
		<div>
			<label for="message" class="block text-sm font-medium text-neutral-300 mb-2">
				Message
			</label>
			<textarea
				id="message"
				bind:value={message}
				disabled={status === 'running'}
				rows={4}
				class="w-full px-4 py-3 bg-neutral-800 text-white border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
				placeholder="Enter your message here..."
			/>
		</div>

		<div class="flex gap-3">
			<button
				type="submit"
				disabled={status === 'running' || !trimmedMessage}
				class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{status === 'running' ? 'Processing...' : 'Submit'}
			</button>

			{#if showClear && status !== 'running'}
				<button
					type="button"
					onclick={handleClear}
					class="px-4 py-2 bg-neutral-700 text-white rounded-lg font-medium hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-colors"
				>
					Clear
				</button>
			{/if}
		</div>

		{#if status === 'error'}
			<div class="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
				An error occurred while processing. Please try again.
			</div>
		{/if}
	</form>
</div>
```

## roadmap:

1. make the docs actually real & useful:
   - pages for each piece of the library with good examples
   - automatic setup with llm prompts (copy into cursor agent and get river working in seconds)
2. really good cursor rules for river
3. s2 provider for river
