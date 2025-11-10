import { myRiverClient } from '@/lib/river/client';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: App });

function App() {
	const basicCaller = myRiverClient.basic.useStream({
		onChunk: (chunk) => {
			console.log(chunk);
		},
		onStart: () => {
			console.log('starting stream');
		},
		onSuccess: () => {
			console.log('stream ended');
		},
		onInfo: (info) => {
			console.log(info);
		}
	});

	return (
		<div>
			<h1>Hello World</h1>
			<button onClick={() => basicCaller.start({ prompt: 'Hello, world!' })}>Start</button>
		</div>
	);
}
