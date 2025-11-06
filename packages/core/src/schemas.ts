import z from 'zod';

// river server schemas

export const resumeRiverStreamParamsSchema = z.object({
	resumeKey: z.string()
});

export const startRiverStreamBodySchema = z.object({
	routerStreamKey: z.string(),
	input: z.unknown()
});
