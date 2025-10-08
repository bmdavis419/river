import { riverClient } from '../river/client.js';

// TODO: bring this back...
// type AgentInput = RiverClientCallerInputType<typeof riverClient.chatAgent>;

export class ChatStore {
	messages = $state<{ role: 'assistant' | 'system' | 'user'; content: string }[]>([
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
		onSuccess: () => {
			this.isSending = false;
			this.currentInput = '';
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
