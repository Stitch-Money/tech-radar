#!/usr/bin/env node
/**
 * Builds docs/config.json from a structured source config.
 *
 * The source config uses quadrant names as top-level keys and ring names nested
 * under each (matching docs/index.html). Each ring holds an array of items.
 *
 * Usage: node scripts/build-config.js [source.json] [output.json]
 * Default: reads docs/radar-source.json, writes docs/config.json
 */

const fs = require('fs');
const path = require('path');

// Must match order in docs/index.html
const QUADRANT_NAMES = [
  'Techniques and Patterns',
  'Platforms',
  'Languages and Frameworks',
  'Tools',
];
const RING_NAMES = ['Adopt', 'Trial', 'Assess', 'Hold'];

const QUADRANT_INDEX = Object.fromEntries(QUADRANT_NAMES.map((name, i) => [name, i]));
const RING_INDEX = Object.fromEntries(RING_NAMES.map((name, i) => [name, i]));

function normalizeItem(item) {
  if (typeof item === 'string') {
    return { label: item, description: '', active: true, moved: 0 };
  }
  return {
    label: item.label,
    description: item.description ?? '',
    link: item.link,
    active: item.active !== false,
    moved: typeof item.moved === 'number' ? item.moved : 0,
  };
}

function buildEntries(source) {
  const entries = [];
  for (const quadrantName of QUADRANT_NAMES) {
    const quadrantData = source[quadrantName];
    if (!quadrantData || typeof quadrantData !== 'object') continue;
    const quadrantIdx = QUADRANT_INDEX[quadrantName];
    for (const ringName of RING_NAMES) {
      const items = quadrantData[ringName];
      if (!Array.isArray(items)) continue;
      const ringIdx = RING_INDEX[ringName];
      for (const item of items) {
        const normalized = normalizeItem(item);
        const entry = {
          description: normalized.description ?? '',
          moved: normalized.moved,
          label: normalized.label,
          quadrant: quadrantIdx,
          active: normalized.active,
          ring: ringIdx,
        };
        if (normalized.link != null) entry.link = normalized.link;
        entries.push(entry);
      }
    }
  }
  return entries;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const sourcePath = path.resolve(
    root,
    process.argv[2] || 'docs/radar-source.json'
  );
  const outputPath = path.resolve(
    root,
    process.argv[3] || 'docs/config.json'
  );

  let source;
  try {
    source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (err) {
    console.error('Failed to read source config:', sourcePath, err.message);
    process.exit(1);
  }

  const date = source.date || '2025.04';
  const entries = buildEntries(source);

  const output = {
    date,
    entries,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log('Wrote', outputPath, 'with', entries.length, 'entries.');
}

main();
