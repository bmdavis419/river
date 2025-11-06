import { createServerSideCaller } from '@davis7dotsh/river-core';
import { myRiverRouter } from './router';

export const myServerCaller = createServerSideCaller(myRiverRouter);

const test = async () => {
	const bgStartResult = await myServerCaller.startStreamInBackground('basic')({
		input: {
			prompt: 'Hello, world!'
		},
		adapterRequest: null
	});

	if (bgStartResult.isErr()) {
		console.error(bgStartResult.error);
		return;
	}

	const bgStartResultValue = bgStartResult.value;

	console.log(bgStartResultValue);
};
