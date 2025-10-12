<script lang="ts">
	import type { TextStreamPart, Tool, ToolSet } from 'ai';
	import { myV3Client } from './client.js';
	import type { ClientSideCaller } from '$lib/v3_dev/types.js';

	// AI SDK HELPERS
	type InferAiSdkToolSetType<T extends ClientSideCaller<any, TextStreamPart<any>>> =
		T extends ClientSideCaller<any, TextStreamPart<infer Tools>> ? Tools : never;

	type InferAiSdkToolCallInputType<T extends ToolSet, K extends keyof T> =
		T[K] extends Tool<infer Input> ? Input : never;

	type InferAiSdkToolCallOutputType<T extends ToolSet, K extends keyof T> =
		T[K] extends Tool<infer _, infer Output> ? Output : never;

	// NORMAL HELPERS
	type InferStreamInputType<T extends ClientSideCaller<any, any>> =
		T extends ClientSideCaller<infer Input, any> ? Input : never;
	type InferStreamChunkType<T extends ClientSideCaller<any, any>> =
		T extends ClientSideCaller<any, infer Chunk> ? Chunk : never;

	type QuestionAskerToolSet = InferAiSdkToolSetType<typeof questionAskerTest>;
	type QuestionAskerToolCallInputType = InferAiSdkToolCallInputType<
		QuestionAskerToolSet,
		'is_imposter'
	>;
	type QuestionAskerToolCallOutputType = InferAiSdkToolCallOutputType<
		QuestionAskerToolSet,
		'is_imposter'
	>;

	type QuestionAgentDisplay =
		| {
				type: 'tool-call';
				tool: {
					toolName: 'is_imposter';
					toolInput: QuestionAskerToolCallInputType;
					toolOutput: QuestionAskerToolCallOutputType;
				};
		  }
		| {
				type: 'text';
				id: string;
				text: string;
		  }
		| {
				type: 'break';
		  };

	type VowelCounterDisplay = InferStreamChunkType<typeof vowelCounterTest>;

	const vowelCounterDisplay = $state<VowelCounterDisplay[]>([]);

	const questionAgentDisplay = $state<QuestionAgentDisplay[]>([]);

	const questionAskerTest = myV3Client.questionAsker({
		onStart: () => {
			console.log('Starting');
		},
		onChunk: (chunk) => {
			if (chunk.type === 'tool-result' && !chunk.dynamic) {
				questionAgentDisplay.push({
					type: 'tool-call',
					tool: {
						toolName: chunk.toolName,
						toolInput: chunk.input,
						toolOutput: chunk.output
					}
				});
			} else if (chunk.type === 'finish-step') {
				questionAgentDisplay.push({
					type: 'break'
				});
			} else if (chunk.type === 'text-start') {
				questionAgentDisplay.push({
					type: 'text',
					id: chunk.id,
					text: ''
				});
			} else if (chunk.type === 'text-delta') {
				const currentText = questionAgentDisplay.find(
					(d) => d.type === 'text' && d.id === chunk.id
				);
				if (currentText && currentText.type === 'text') {
					currentText.text += chunk.text;
				}
			}
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

	const vowelCounterTest = myV3Client.vowelCounter({
		onStart: () => {
			console.log('Starting');
		},
		onChunk: (chunk) => {
			vowelCounterDisplay.push(chunk);
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

<div class="mx-auto max-w-2xl p-8">
	<div class="mb-8 rounded-lg border border-neutral-600 bg-neutral-800 p-6">
		<h2 class="mb-4 text-xl font-semibold text-white">Test Controls</h2>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="flex flex-col gap-3">
				<h3 class="text-lg font-medium text-white">Vowel Counter</h3>
				<div class="mb-2 flex items-center gap-2">
					<span class="text-sm text-neutral-400">Status:</span>
					<span
						class="rounded px-2 py-1 text-xs font-medium {vowelCounterTest.status === 'idle'
							? 'bg-neutral-700 text-neutral-300'
							: vowelCounterTest.status === 'running'
								? 'bg-blue-600 text-white'
								: vowelCounterTest.status === 'success'
									? 'bg-green-600 text-white'
									: vowelCounterTest.status === 'error'
										? 'bg-red-600 text-white'
										: 'bg-yellow-600 text-white'}"
					>
						{vowelCounterTest.status}
					</span>
				</div>
				<div class="flex gap-2">
					<button
						class="rounded-md bg-neutral-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={vowelCounterTest.status === 'running'}
						onclick={() => vowelCounterTest.start({ yourName: 'this is a test...' })}
					>
						Start
					</button>
					{#if vowelCounterTest.status === 'running'}
						<button
							class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
							onclick={() => vowelCounterTest.stop()}
						>
							Stop
						</button>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-3">
				<h3 class="text-lg font-medium text-white">Question Asker</h3>
				<div class="mb-2 flex items-center gap-2">
					<span class="text-sm text-neutral-400">Status:</span>
					<span
						class="rounded px-2 py-1 text-xs font-medium {questionAskerTest.status === 'idle'
							? 'bg-neutral-700 text-neutral-300'
							: questionAskerTest.status === 'running'
								? 'bg-blue-600 text-white'
								: questionAskerTest.status === 'success'
									? 'bg-green-600 text-white'
									: questionAskerTest.status === 'error'
										? 'bg-red-600 text-white'
										: 'bg-yellow-600 text-white'}"
					>
						{questionAskerTest.status}
					</span>
				</div>
				<div class="flex gap-2">
					<button
						class="rounded-md bg-neutral-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={questionAskerTest.status === 'running'}
						onclick={() => questionAskerTest.start({ prompt: 'What is the capital of France?' })}
					>
						Start
					</button>
					{#if questionAskerTest.status === 'running'}
						<button
							class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
							onclick={() => questionAskerTest.stop()}
						>
							Stop
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	{#if vowelCounterDisplay.length > 0 || questionAgentDisplay.length > 0}
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#if vowelCounterDisplay.length > 0}
				<div class="rounded-lg border border-neutral-600 bg-neutral-800 p-6">
					<h2 class="mb-4 text-xl font-semibold text-white">Vowel Counter Results</h2>
					<div class="flex flex-col gap-3">
						{#each vowelCounterDisplay as chunk, index}
							<div
								class="rounded-md border border-neutral-600 bg-neutral-700 p-3 font-mono text-sm leading-relaxed"
							>
								<span class="mr-2 font-semibold text-neutral-400">Letter {index + 1}:</span>
								<span class="mr-2 text-2xl font-bold text-white uppercase">{chunk.letter}</span>
								<span
									class="rounded px-2 py-0.5 text-xs font-semibold tracking-wide uppercase {chunk.isVowel
										? 'bg-neutral-600 text-white'
										: 'bg-neutral-500 text-white'}"
								>
									{chunk.isVowel ? 'Vowel' : 'Consonant'}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if questionAgentDisplay.length > 0}
				<div class="rounded-lg border border-neutral-600 bg-neutral-800 p-6">
					<h2 class="mb-4 text-xl font-semibold text-white">Question Asker Results</h2>
					<div class="flex flex-col gap-3">
						{#each questionAgentDisplay as item}
							<div class="rounded-md border border-neutral-600 bg-neutral-700 p-3">
								{#if item.type === 'tool-call'}
									<div class="rounded-md border border-neutral-500 bg-neutral-600 p-4">
										<span class="font-semibold text-neutral-400">{item.tool.toolName}</span>
										{#if item.tool.toolInput}
											<div
												class="mt-2 rounded border border-neutral-400 bg-neutral-500 p-2 text-xs break-all whitespace-pre-wrap text-neutral-300"
											>
												Input: {JSON.stringify(item.tool.toolInput, null, 2)}
											</div>
										{/if}
										{#if item.tool.toolOutput}
											<div
												class="mt-2 rounded border border-neutral-400 bg-neutral-500 p-2 text-xs break-all whitespace-pre-wrap text-neutral-400"
											>
												Output: {JSON.stringify(item.tool.toolOutput, null, 2)}
											</div>
										{/if}
									</div>
								{:else if item.type === 'text'}
									<div
										class="rounded-md border border-neutral-600 bg-neutral-700 p-4 leading-relaxed"
									>
										<span class="font-sans text-white">{item.text}</span>
									</div>
								{:else if item.type === 'break'}
									<hr class="my-2 border-neutral-600" />
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
