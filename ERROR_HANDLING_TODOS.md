# Error Handling TODOs

## Stream Lifecycle Issues

### 1. S2Core Instance Cleanup (providers.ts:83-86)

New `S2Core` instance created in `resumeStream` but never disposed. If S2Core has internal state or connections, they could leak. Consider if S2Core needs explicit disposal or if it auto-cleans.

### 2. Server Error Handling on Resume (server.ts:59)

GET handler calls `provider.resumeStream()` without error handling. If the provider throws or partially initializes resources, cleanup won't occur. Wrap in try-catch and ensure S2 resources are cleaned up on failure.

### 3. Partial Stream Initialization Leaks (server.ts:59)

If `resumeStream` fails after S2 resource allocation, those resources may remain open. Need explicit cleanup on error paths.
