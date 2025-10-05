import type { InferClientSideCallerInputType } from '$lib/index.js';
import { riverClient } from '../river/client.js';

type AgentInput = InferClientSideCallerInputType<typeof riverClient.chatAgent>;

export class ChatStore {
	messages = $state<AgentInput>([
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

	private chatAgentCaller = riverClient.chatAgent({
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
