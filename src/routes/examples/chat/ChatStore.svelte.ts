import type { AssistantModelMessage, ModelMessage, SystemModelMessage } from 'ai';
import { riverClient } from '../river/client.js';
import type { InferRiverAgentInputType } from '$lib/index.js';

export class ChatStore {
	// TODO: should have the ability to grab types easily out of the
	messages = $state<
		{
			role: 'system' | 'user' | 'assistant';
			content: string;
		}[]
	>([
		{
			role: 'assistant',
			content: 'Hello, how can I help you today?'
		}
	]);
	isSending = $state(false);
	currentInput = $state('');
	lastMessageDuration = $state<number | null>(null);
	lastMessageChunkCount = $state<number | null>(null);

	constructor() {
		$inspect(this.messages);
	}

	private chatAgentCaller = riverClient.exampleChatAgent({
		onStart: () => {
			this.isSending = true;
			this.messages.push({
				role: 'assistant',
				content: ''
			});
		},
		onChunk: (chunk) => {
			if (chunk.type === 'text-delta') {
				this.messages[this.messages.length - 1].content += chunk.text;
			}
		},
		onCancel: () => {
			console.warn('cancelled');
		},
		onError: (error) => {
			console.error(error);
		},
		onComplete: (data) => {
			this.isSending = false;
			this.currentInput = '';
			this.lastMessageDuration = data.duration;
			this.lastMessageChunkCount = data.totalChunks;
		}
	});

	async sendMessage() {
		this.messages.push({
			role: 'user',
			content: this.currentInput
		});
		this.chatAgentCaller.start(this.messages);
	}

	stop() {
		this.chatAgentCaller.stop();
	}
}
