import type { CreateAgentRouter, CreateRiverAgent } from './types.js';

const createRiverAgent: CreateRiverAgent = (args) => {
	const { inputSchema, stream, runner } = args;

	return {
		inputSchema,
		stream,
		runner
	};
};

const createAgentRouter: CreateAgentRouter = (agents) => {
	return agents as any;
};

export { createAgentRouter, createRiverAgent };
