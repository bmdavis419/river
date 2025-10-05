<script lang="ts">
	import { ChatStore } from './ChatStore.svelte.js';

	const chatStore = new ChatStore();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (chatStore.currentInput.trim() && !chatStore.isSending) {
				chatStore.sendMessage();
			}
		}
	}
</script>

<div class="flex h-full flex-col bg-[var(--color-background)]">
	<!-- Chat Messages Area -->
	<div class="flex-1 space-y-4 overflow-y-auto px-8 pt-4 pb-36">
		{#each chatStore.messages as message (message.content + message.role)}
			<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div
					class="
					max-w-[70%] rounded-lg p-3
					{message.role === 'user'
						? 'bg-[var(--color-primary)] text-[var(--color-text)]'
						: 'bg-[var(--color-surface)] text-[var(--color-text)]'}
				"
				>
					<p class="whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		{/each}

		{#if chatStore.isSending}
			<div class="flex justify-start">
				<div class="rounded-lg bg-[var(--color-surface)] p-3 text-[var(--color-text-secondary)]">
					<div class="flex items-center space-x-2">
						<div class="animate-pulse">Typing...</div>
						<button
							onclick={chatStore.stop}
							class="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
						>
							Stop
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input Area - Fixed to Bottom -->
	<div
		class="fixed right-0 bottom-0 left-0 border-t border-[var(--color-surface)] bg-[var(--color-background)] p-4"
	>
		<div class="flex space-x-2">
			<textarea
				bind:value={chatStore.currentInput}
				onkeydown={handleKeydown}
				placeholder="Type your message..."
				class="
					flex-1 resize-none rounded-lg border border-[var(--color-surface)]
					bg-[var(--color-surface)] p-3
					text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)]
					focus:outline-none
				"
				rows="1"
				disabled={chatStore.isSending}
			></textarea>
			<button
				onclick={chatStore.sendMessage}
				disabled={!chatStore.currentInput.trim() || chatStore.isSending}
				class="
					rounded-lg px-6 py-3 font-medium transition-colors
					{!chatStore.currentInput.trim() || chatStore.isSending
					? 'cursor-not-allowed bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
					: 'hover:bg-opacity-90 bg-[var(--color-primary)] text-[var(--color-text)]'}
				"
			>
				{chatStore.isSending ? 'Sending...' : 'Send'}
			</button>
		</div>

		{#if chatStore.lastMessageDuration !== null}
			<div class="mt-2 text-xs text-[var(--color-text-secondary)]">
				Last message: {chatStore.lastMessageDuration}ms ({chatStore.lastMessageChunkCount} chunks)
			</div>
		{/if}
	</div>
</div>
