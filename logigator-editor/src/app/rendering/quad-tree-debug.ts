import { Rectangle } from 'pixi.js';
import { GridElement } from './grid-element';
import { formatIndexHistogram } from '../utils/histogram';
import type { QuadTreeEntry, Quadrant } from './quad-tree-container';

/**
 * The tuning numbers a measurement reads: the container's own capacity and
 * size thresholds, passed in because they belong to the tree, not to the
 * report. Reproduced verbatim in {@link QuadTreeStats.thresholds}.
 */
export interface QuadTreeLimits {
  maxLeafElements: number;
  minBranchElements: number;
  minLeafSize: number;
  initialSize: number;
  renderGroupMinSize: number;
}

/** The read-only view of a tree these reports walk. */
type Items<T extends GridElement> = ReadonlyMap<T, QuadTreeEntry<T>>;

/** Shape and occupancy of a whole tree; see {@link collectQuadTreeStats}. */
export interface QuadTreeStats {
  /** Elements the tree tracks. */
  elements: number;
  entries: number;
  leaves: number;
  branches: number;
  /** Entries large enough to be their own PixiJS render group. */
  renderGroups: number;
  /** Leaves holding nothing — a large share means minifyBranch is not merging. */
  emptyLeaves: number;
  /** Entries the last cull pass flagged off-screen. */
  culledEntries: number;
  maxDepth: number;
  /** Depth of an average element: the levels a point query descends. */
  avgElementDepth: number;
  entriesByDepth: number[];
  elementsByDepth: number[];
  /**
   * Elements parked at a branch because they are too large for its children —
   * wider or taller than half the branch cell — by depth. Every range query
   * passing through that branch tests all of them, so the depth-0 count is
   * paid by every query the tree ever answers. Only an element's size parks
   * it at a branch; its position never does.
   */
  branchOversizeByDepth: number[];
  branchOversize: number;
  /**
   * Elements too large for a child of the leaf they sit in. A split cannot
   * move them down, so they are what puts a leaf legitimately over capacity.
   */
  leafOversize: number;
  /** Leaf count indexed by how many elements the leaf holds. */
  leafOccupancy: number[];
  /**
   * Leaves whose splittable elements exceed the capacity at a size a split
   * could still relieve — an invariant violation.
   */
  overfullSplittableLeaves: number;
  /** Leaves over capacity that a split cannot relieve. */
  saturatedLeaves: number;
  /** Root region plus how often expand() doubled it past the initial size. */
  root: { x: number; y: number; size: number; expansions: number };
  /** Extent the elements actually occupy, or null while the tree is empty. */
  occupied: Rectangle | null;
  /** Fraction of the root region the occupied extent covers. */
  rootFill: number;
  thresholds: QuadTreeLimits;
}

/** `x,y w×h` — the compact region form the debug output uses throughout. */
function describeRect(rect: Rectangle): string {
  return `${rect.x},${rect.y} ${rect.width}×${rect.height}`;
}

/** Element type plus grid footprint: enough to find it on the board. */
function describeElement(element: GridElement): string {
  return `${element.constructor.name} at ${describeRect(element.gridBounds)}`;
}

/**
 * Measures a live tree: its shape, where the elements sit in it, and how far
 * it drifted from the region it started with. Walks every entry, so it is a
 * debug-only call.
 */
export function collectQuadTreeStats<T extends GridElement>(
  tree: QuadTreeEntry<T>,
  items: Items<T>,
  limits: QuadTreeLimits
): QuadTreeStats {
  const root = tree.region;
  const stats: QuadTreeStats = {
    elements: items.size,
    entries: 0,
    leaves: 0,
    branches: 0,
    renderGroups: 0,
    emptyLeaves: 0,
    culledEntries: 0,
    maxDepth: 0,
    avgElementDepth: 0,
    entriesByDepth: [],
    elementsByDepth: [],
    branchOversizeByDepth: [],
    branchOversize: 0,
    leafOversize: 0,
    leafOccupancy: [],
    overfullSplittableLeaves: 0,
    saturatedLeaves: 0,
    root: {
      x: root.x,
      y: root.y,
      size: root.width,
      expansions: Math.round(Math.log2(root.width / limits.initialSize))
    },
    occupied: occupiedExtent(items),
    rootFill: 0,
    // Copied so a measurement never hands out the container's own limits.
    thresholds: { ...limits }
  };

  collectStats(tree, 0, stats, limits);

  let depthSum = 0;
  for (let depth = 0; depth < stats.elementsByDepth.length; depth++) {
    depthSum += depth * (stats.elementsByDepth[depth] ?? 0);
  }
  stats.avgElementDepth = stats.elements > 0 ? depthSum / stats.elements : 0;
  if (stats.occupied) {
    stats.rootFill =
      (stats.occupied.width * stats.occupied.height) /
      (root.width * root.height);
  }
  return stats;
}

function collectStats<T extends GridElement>(
  entry: QuadTreeEntry<T>,
  depth: number,
  stats: QuadTreeStats,
  limits: QuadTreeLimits
): void {
  stats.entries++;
  stats.maxDepth = Math.max(stats.maxDepth, depth);
  stats.entriesByDepth[depth] = (stats.entriesByDepth[depth] ?? 0) + 1;
  stats.elementsByDepth[depth] ??= 0;
  stats.branchOversizeByDepth[depth] ??= 0;
  if (entry.size >= limits.renderGroupMinSize) stats.renderGroups++;
  if (entry.culled) stats.culledEntries++;

  const oversize = entry.oversizeItems.children.length;
  if (entry.branches) {
    // Elements too large for a child cell park here, and every range query
    // that passes through the entry on its way down tests each of them.
    stats.branches++;
    stats.branchOversize += oversize;
    stats.branchOversizeByDepth[depth] += oversize;
    stats.elementsByDepth[depth] += oversize;
    collectStats(entry.branches.nw, depth + 1, stats, limits);
    collectStats(entry.branches.ne, depth + 1, stats, limits);
    collectStats(entry.branches.sw, depth + 1, stats, limits);
    collectStats(entry.branches.se, depth + 1, stats, limits);
    return;
  }

  stats.leaves++;
  const filed = entry.leafItems!.children.length;
  const held = oversize + filed;
  stats.leafOversize += oversize;
  stats.elementsByDepth[depth] += held;
  stats.leafOccupancy[held] = (stats.leafOccupancy[held] ?? 0) + 1;
  if (held === 0) stats.emptyLeaves++;
  if (held > limits.maxLeafElements) {
    if (isOverfullSplittable(entry, limits)) {
      stats.overfullSplittableLeaves++;
    } else {
      stats.saturatedLeaves++;
    }
  }
}

/**
 * Whether a leaf holds more splittable elements than its capacity at a size a
 * split could still relieve. Splitting only redistributes the elements a
 * child cell can hold, so a leaf over capacity through oversize elements, or
 * one already at the minimum size, is legitimately over it instead.
 */
function isOverfullSplittable<T extends GridElement>(
  entry: QuadTreeEntry<T>,
  limits: QuadTreeLimits
): boolean {
  return (
    !entry.branches &&
    entry.leafItems!.children.length > limits.maxLeafElements &&
    entry.size >= limits.minLeafSize * 2
  );
}

/** Union of every element's cullBounds, or null while the tree is empty. */
function occupiedExtent<T extends GridElement>(
  items: Items<T>
): Rectangle | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of items.keys()) {
    const b = element.cullBounds;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.right > maxX) maxX = b.right;
    if (b.bottom > maxY) maxY = b.bottom;
  }
  if (!Number.isFinite(minX)) return null;
  return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

/**
 * Charts the distributions {@link collectQuadTreeStats} counts — the part of a
 * measurement that a bar reads better than an array. The scalar counts stay in
 * the stats object itself.
 * @param s measurement to chart
 */
export function formatQuadTreeDistributions(s: QuadTreeStats): string {
  return [
    ...formatIndexHistogram('entries by depth', s.entriesByDepth),
    '',
    ...formatIndexHistogram('elements by depth', s.elementsByDepth),
    '',
    ...formatIndexHistogram(
      'branch oversize by depth (query-cost multiplier)',
      s.branchOversizeByDepth
    ),
    '',
    ...formatIndexHistogram('leaves by element count', s.leafOccupancy)
  ].join('\n');
}

/**
 * Draws the entry hierarchy as an indented text tree, one line per entry
 * with its region and occupancy. Subtrees below `maxDepth` collapse into a
 * single summary line.
 * @param maxDepth deepest level to expand
 */
export function formatQuadTree<T extends GridElement>(
  tree: QuadTreeEntry<T>,
  maxDepth = Infinity
): string {
  const lines: string[] = [];
  formatEntry(tree, 0, '', '', '', maxDepth, lines);
  return lines.join('\n');
}

/**
 * @param prefix guides plus the connector for this entry's own line
 * @param indent guides its children's connectors hang off
 */
function formatEntry<T extends GridElement>(
  entry: QuadTreeEntry<T>,
  depth: number,
  label: string,
  prefix: string,
  indent: string,
  maxDepth: number,
  lines: string[]
): void {
  const b = entry.region;
  const oversize = entry.oversizeItems.children.length;
  const parts = [`${prefix}${label}[${b.x},${b.y} size ${b.width}]`];
  if (entry.branches) {
    parts.push('branch');
  } else {
    parts.push(`leaf ${oversize + entry.leafItems!.children.length}`);
  }
  if (oversize > 0) parts.push(`${oversize} oversize`);
  if (entry.culled) parts.push('culled');
  lines.push(parts.join(' '));

  if (!entry.branches) return;
  if (depth >= maxDepth) {
    const below = subtreeTotals(entry);
    lines.push(
      `${indent}└─ … ${below.entries - 1} entries below, ${below.elements} elements`
    );
    return;
  }

  const quadrants = ['nw', 'ne', 'sw', 'se'] as const;
  quadrants.forEach((quadrant, index) => {
    const last = index === quadrants.length - 1;
    formatEntry(
      entry.branches![quadrant],
      depth + 1,
      `${quadrant} `,
      `${indent}${last ? '└─ ' : '├─ '}`,
      `${indent}${last ? '   ' : '│  '}`,
      maxDepth,
      lines
    );
  });
}

/** Entry and element totals of the subtree rooted at `entry`, inclusive. */
function subtreeTotals<T extends GridElement>(
  entry: QuadTreeEntry<T>
): {
  entries: number;
  elements: number;
} {
  let entries = 1;
  let elements = entry.oversizeItems.children.length;
  if (entry.branches) {
    for (const child of Object.values(entry.branches)) {
      const below = subtreeTotals(child);
      entries += below.entries;
      elements += below.elements;
    }
  } else {
    elements += entry.leafItems!.children.length;
  }
  return { entries, elements };
}

/**
 * Cross-checks a tree against its own invariants and returns one message
 * per problem — empty for a healthy tree. Catches the three states the
 * mutation paths panic on, a leaf a split should have relieved, and the silent
 * one they cannot see: an element that moved out of the region it is filed
 * under without being re-inserted.
 */
export function validateQuadTree<T extends GridElement>(
  tree: QuadTreeEntry<T>,
  items: Items<T>,
  limits: QuadTreeLimits
): string[] {
  const problems: string[] = [];
  const seen = new Set<T>();

  for (const [element, entry] of items) {
    const inOversize = entry.oversizeItems.children.includes(element);
    const inLeaf = entry.leafItems?.children.includes(element) ?? false;
    const where = `element ${describeElement(element)} filed under entry [${describeRect(entry.region)}]`;
    if (!inOversize && !inLeaf) {
      problems.push(`${where} sits in neither oversizeItems nor leafItems`);
      continue;
    }

    const elBounds = element.cullBounds;
    const elSize = Math.max(elBounds.width, elBounds.height);
    const cx = elBounds.x + elBounds.width / 2;
    const cy = elBounds.y + elBounds.height / 2;
    const region = entry.region;
    if (!entry.boundsArea.containsRect(elBounds)) {
      problems.push(
        `${where} has cullBounds ${describeRect(elBounds)} outside the loose bounds ${describeRect(entry.boundsArea)} — it moved without being re-inserted`
      );
      continue;
    }
    if (
      cx < region.x ||
      cx > region.right ||
      cy < region.y ||
      cy > region.bottom
    ) {
      problems.push(
        `${where} has its center at ${cx},${cy} outside that cell — it moved without being re-inserted`
      );
      continue;
    }
    if (elSize > entry.size) {
      problems.push(
        `${where} is larger than the cell (${elSize} > ${entry.size}) and belongs at a higher level`
      );
    } else if (inOversize && elSize <= entry.size / 2) {
      problems.push(`${where} fits a child cell and belongs one level deeper`);
    } else if (inLeaf && elSize > entry.size / 2) {
      problems.push(
        `${where} is too large for a child cell and belongs in oversizeItems`
      );
    }
  }

  validateEntry(tree, items, seen, problems, limits);
  for (const element of seen) {
    if (!items.has(element)) {
      problems.push(
        `element ${describeElement(element)} hangs in the tree but is missing from the item map`
      );
    }
  }
  if (seen.size !== items.size) {
    problems.push(
      `item map holds ${items.size} elements, the tree holds ${seen.size}`
    );
  }
  return problems;
}

function validateEntry<T extends GridElement>(
  entry: QuadTreeEntry<T>,
  items: Items<T>,
  seen: Set<T>,
  problems: string[],
  limits: QuadTreeLimits
): void {
  const region = describeRect(entry.region);
  if (entry.branches && entry.leafItems) {
    problems.push(`entry [${region}] has both branches and leafItems`);
  }
  if (!entry.branches && !entry.leafItems) {
    problems.push(`entry [${region}] has neither branches nor leafItems`);
  }
  if (isOverfullSplittable(entry, limits)) {
    problems.push(
      `leaf [${region}] holds ${entry.leafItems!.children.length} splittable elements over the capacity of ${limits.maxLeafElements} at a size a split could still relieve`
    );
  }

  const children = [
    ...entry.oversizeItems.children,
    ...(entry.leafItems?.children ?? [])
  ];
  for (const element of children) {
    if (seen.has(element)) {
      problems.push(
        `element ${describeElement(element)} hangs in the tree twice`
      );
    }
    seen.add(element);
    if (items.get(element) !== entry) {
      problems.push(
        `element ${describeElement(element)} hangs under entry [${region}] but the item map points elsewhere`
      );
    }
  }

  if (!entry.branches) return;
  const b = entry.region;
  const half = b.width / 2;
  const expected: Record<Quadrant, [number, number]> = {
    nw: [b.x, b.y],
    ne: [b.x + half, b.y],
    sw: [b.x, b.y + half],
    se: [b.x + half, b.y + half]
  };
  for (const [quadrant, [x, y]] of Object.entries(expected) as [
    Quadrant,
    [number, number]
  ][]) {
    const child = entry.branches[quadrant];
    const cb = child.region;
    if (cb.x !== x || cb.y !== y || cb.width !== half) {
      problems.push(
        `entry [${region}] has a ${quadrant} branch at [${describeRect(cb)}] instead of [${x},${y} ${half}×${half}]`
      );
    }
    validateEntry(child, items, seen, problems, limits);
  }
}
