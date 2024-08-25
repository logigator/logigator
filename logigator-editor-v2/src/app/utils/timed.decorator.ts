export function Timed(
	target: unknown,
	key: string,
	descriptor: PropertyDescriptor
): PropertyDescriptor {
	if (descriptor.value) {
		setupTimedDecorator(descriptor, 'value', key);
	}
	if (descriptor.get) {
		setupTimedDecorator(descriptor, 'get', key);
	}
	if (descriptor.set) {
		setupTimedDecorator(descriptor, 'set', key);
	}

	return descriptor;
}

function setupTimedDecorator(
	descriptor: PropertyDescriptor,
	key: 'value' | 'get' | 'set',
	propertyKey: string
): void {
	const originalMethod = descriptor[key];

	descriptor[key] = function (...args: unknown[]) {
		const start = performance.now();
		const result = originalMethod.apply(this, args);
		const end = performance.now();

		// eslint-disable-next-line no-console
		console.log(`Execution time for "%s": %s ms`, propertyKey, (end - start).toFixed(2));
		return result;
	};
}
