/**
 * The minimal shape of a forkable resource (Project / Component) needed to walk
 * its fork lineage. Structural so this module stays free of entity imports.
 */
interface ForkableLike {
	id: string;
	name: string;
	forkedFrom: Promise<ForkableLike | undefined | null>;
	user: Promise<{ username: string }>;
}

/** One ancestor in a resource's fork lineage. */
export interface ForkAttributionEntry {
	projectId: string;
	projectName: string;
	authorName: string;
}

/**
 * Walks a resource's `forkedFrom` chain and returns the ancestor lineage
 * **root-first** (the original creation is entry 0, the immediate parent is
 * last). The chain is resolved entirely from the database — clients never
 * supply names — so an entry always names the ancestor's real author. A
 * deleted ancestor truncates the chain there (`forkedFrom` is SET NULL on
 * delete); a repeated id stops the walk (defensive cycle guard).
 */
export async function buildForkAttribution(resource: ForkableLike): Promise<ForkAttributionEntry[]> {
	const chain: ForkAttributionEntry[] = [];
	const visited = new Set<string>([resource.id]);
	let ancestor = await resource.forkedFrom;
	while (ancestor && !visited.has(ancestor.id)) {
		visited.add(ancestor.id);
		chain.push({
			projectId: ancestor.id,
			projectName: ancestor.name,
			authorName: (await ancestor.user).username
		});
		ancestor = await ancestor.forkedFrom;
	}
	return chain.reverse();
}
