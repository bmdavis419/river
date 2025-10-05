<script lang="ts">
	import { RIVER_CLIENT } from '$lib/index.js';
	import type { ExampleRouter } from './river/router.js';

	let aiSdkStatus = $state<'idle' | 'running' | 'complete' | 'error' | 'cancelled'>('idle');
	let aiSdkText = $state('');
	let aiSdkToolCalls = $state<any[]>([]);
	let aiSdkError = $state<string | null>(null);
	let aiSdkRawChunks = $state<any[]>([]);

	let customStatus = $state<'idle' | 'running' | 'complete' | 'error' | 'cancelled'>('idle');
	let customCharacters = $state<{ character: string; index: number }[]>([]);
	let customStats = $state<{ totalChunks: number; duration: number } | null>(null);
	let customError = $state<string | null>(null);

	const customText = $derived(customCharacters.map((c) => c.character).join(''));

	const clearAll = () => {
		aiSdkStatus = 'idle';
		aiSdkText = '';
		aiSdkToolCalls = [];
		aiSdkError = null;
		aiSdkRawChunks = [];

		customStatus = 'idle';
		customCharacters = [];
		customStats = null;
		customError = null;
	};

	// THIS IS THE IMPORTANT PART
	const riverClient = RIVER_CLIENT.createClientCaller<ExampleRouter>('/example/river');

	const { start: startExampleAiSdkAgent, stop: stopExampleAiSdkAgent } = riverClient
		.agent('exampleAiSdkAgent')
		.makeCaller({
			onStart: () => {
				aiSdkStatus = 'running';
				aiSdkText = '';
				aiSdkToolCalls = [];
				aiSdkError = null;
				aiSdkRawChunks = [];
			},
			onChunk: (chunk) => {
				console.log('AI SDK chunk:', chunk);
				aiSdkRawChunks.push(chunk);

				if (chunk.type === 'text-delta') {
					aiSdkText += (chunk as any).text;
				} else if (chunk.type === 'tool-call') {
					aiSdkToolCalls.push(chunk);
				}
			},
			onComplete: () => {
				aiSdkStatus = 'complete';
			},
			onError: (error) => {
				aiSdkStatus = 'error';
				aiSdkError = error.message || 'Unknown error';
			},
			onCancel: () => {
				aiSdkStatus = 'cancelled';
			}
		});

	const handleFireAiSdkAgent = () => {
		startExampleAiSdkAgent({
			prompt: 'Is the earth flat?'
		});
	};

	const handleStopAiSdkAgent = () => {
		stopExampleAiSdkAgent();
	};

	const { start: startExampleCustomAgent, stop: stopExampleCustomAgent } = riverClient
		.agent('exampleCustomAgent')
		.makeCaller({
			onStart: () => {
				customStatus = 'running';
				customCharacters = [];
				customStats = null;
				customError = null;
			},
			onChunk: (chunk) => {
				customCharacters.push(chunk);
			},
			onComplete: ({ totalChunks, duration }) => {
				customStatus = 'complete';
				customStats = { totalChunks, duration };
			},
			onError: (error) => {
				customStatus = 'error';
				customError = error.message || 'Unknown error';
			},
			onCancel: () => {
				customStatus = 'cancelled';
			}
		});

	const handleFireCustomAgent = () => {
		startExampleCustomAgent({
			yourName:
				'this is a very long run wow look at this wow you could maybe interrupt this hmmmmmm'
		});
	};

	const handleStopCustomAgent = () => {
		stopExampleCustomAgent();
	};
</script>

<div class="mx-auto max-w-4xl space-y-8 p-6">
	<div class="mb-8 flex items-center justify-between">
		<h1 class="text-3xl font-bold text-white">River Demo</h1>
		<button
			onclick={clearAll}
			class="rounded-md bg-neutral-500 px-4 py-2 text-white hover:bg-neutral-600"
		>
			Clear All
		</button>
	</div>

	<p>
		This UI is entirely vibe coded. It's not good or supposed to be, just look at how the streams
		work that's what matters.
	</p>

	<!-- AI SDK Agent Section -->
	<div class="rounded-lg bg-neutral-800 p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-white">AI SDK Agent</h2>
			<div class="flex gap-2">
				<button
					onclick={handleFireAiSdkAgent}
					disabled={aiSdkStatus === 'running'}
					class="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					{aiSdkStatus === 'running' ? 'Running...' : 'Start'}
				</button>
				<button
					onclick={handleStopAiSdkAgent}
					disabled={aiSdkStatus !== 'running'}
					class="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					Stop
				</button>
			</div>
		</div>

		<div class="space-y-4">
			<!-- Status -->
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-neutral-300">Status:</span>
				<span
					class="rounded-full px-2 py-1 text-xs {aiSdkStatus === 'idle'
						? 'bg-neutral-700 text-neutral-300'
						: aiSdkStatus === 'running'
							? 'bg-blue-600 text-blue-100'
							: aiSdkStatus === 'complete'
								? 'bg-green-600 text-green-100'
								: aiSdkStatus === 'cancelled'
									? 'bg-orange-600 text-orange-100'
									: 'bg-red-600 text-red-100'}"
				>
					{aiSdkStatus}
				</span>
			</div>

			<!-- Error -->
			{#if aiSdkError}
				<div class="rounded-md border border-red-600 bg-red-900/20 p-3">
					<p class="text-sm text-red-400">Error: {aiSdkError}</p>
				</div>
			{/if}

			<!-- Cancelled -->
			{#if aiSdkStatus === 'cancelled'}
				<div class="rounded-md border border-orange-600 bg-orange-900/20 p-3">
					<p class="text-sm text-orange-400">Agent was cancelled by user</p>
				</div>
			{/if}

			<!-- Text Output -->
			<div class="min-h-[100px] rounded-md bg-neutral-900 p-4">
				<h3 class="mb-2 text-sm font-medium text-neutral-300">Response:</h3>
				<div class="whitespace-pre-wrap text-neutral-100">
					{aiSdkText || (aiSdkStatus === 'idle' ? 'Click "Start" to see the AI response...' : '')}
				</div>
			</div>

			<!-- Tool Calls -->
			{#if aiSdkToolCalls.length > 0}
				<div class="rounded-md bg-blue-900/20 p-4">
					<h3 class="mb-2 text-sm font-medium text-blue-400">Tool Calls:</h3>
					<div class="space-y-2">
						{#each aiSdkToolCalls as toolCall}
							<div class="rounded bg-neutral-800 p-2 text-sm">
								<div class="font-medium text-white">{toolCall.toolName}</div>
								<div class="text-neutral-300">{JSON.stringify(toolCall.args, null, 2)}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Raw Chunks Debug -->
			{#if aiSdkRawChunks.length > 0}
				<div class="rounded-md bg-yellow-900/20 p-4">
					<h3 class="mb-2 text-sm font-medium text-yellow-400">Raw Chunks (Debug):</h3>
					<div class="max-h-40 space-y-2 overflow-y-auto">
						{#each aiSdkRawChunks as chunk, index}
							<div class="rounded bg-neutral-800 p-2 text-xs">
								<div class="font-medium text-white">Chunk {index + 1}: {chunk.type}</div>
								<div class="font-mono text-neutral-300">{JSON.stringify(chunk, null, 2)}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Custom Agent Section -->
	<div class="rounded-lg bg-neutral-800 p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-white">Custom Agent</h2>
			<div class="flex gap-2">
				<button
					onclick={handleFireCustomAgent}
					disabled={customStatus === 'running'}
					class="rounded-md bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					{customStatus === 'running' ? 'Running...' : 'Start'}
				</button>
				<button
					onclick={handleStopCustomAgent}
					disabled={customStatus !== 'running'}
					class="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					Stop
				</button>
			</div>
		</div>

		<div class="space-y-4">
			<!-- Status -->
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-neutral-300">Status:</span>
				<span
					class="rounded-full px-2 py-1 text-xs {customStatus === 'idle'
						? 'bg-neutral-700 text-neutral-300'
						: customStatus === 'running'
							? 'bg-blue-600 text-blue-100'
							: customStatus === 'complete'
								? 'bg-green-600 text-green-100'
								: customStatus === 'cancelled'
									? 'bg-orange-600 text-orange-100'
									: 'bg-red-600 text-red-100'}"
				>
					{customStatus}
				</span>
			</div>

			<!-- Error -->
			{#if customError}
				<div class="rounded-md border border-red-600 bg-red-900/20 p-3">
					<p class="text-sm text-red-400">Error: {customError}</p>
				</div>
			{/if}

			<!-- Cancelled -->
			{#if customStatus === 'cancelled'}
				<div class="rounded-md border border-orange-600 bg-orange-900/20 p-3">
					<p class="text-sm text-orange-400">Agent was cancelled by user</p>
				</div>
			{/if}

			<!-- Character Output -->
			<div class="min-h-[100px] rounded-md bg-neutral-900 p-4">
				<h3 class="mb-2 text-sm font-medium text-neutral-300">Character Stream:</h3>
				<div class="font-mono text-lg text-neutral-100">
					{customText ||
						(customStatus === 'idle' ? 'Click "Start" to see characters stream...' : '')}
				</div>
			</div>

			<!-- Character Details -->
			{#if customCharacters.length > 0}
				<div class="rounded-md bg-green-900/20 p-4">
					<h3 class="mb-2 text-sm font-medium text-green-400">Character Details:</h3>
					<div class="grid grid-cols-8 gap-2">
						{#each customCharacters as char}
							<div class="rounded bg-neutral-800 p-2 text-center text-sm">
								<div class="font-mono text-lg text-white">{char.character}</div>
								<div class="text-xs text-neutral-400">#{char.index}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Stats -->
			{#if customStats}
				<div class="rounded-md bg-neutral-900 p-4">
					<h3 class="mb-2 text-sm font-medium text-neutral-300">Completion Stats:</h3>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span class="font-medium text-neutral-300">Total Chunks:</span>
							<span class="text-neutral-100">{customStats.totalChunks}</span>
						</div>
						<div>
							<span class="font-medium text-neutral-300">Duration:</span>
							<span class="text-neutral-100">{customStats.duration}ms</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
