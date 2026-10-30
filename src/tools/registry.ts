// Finds every Tool by its declaration at build time, so there is no central list.
// Folders starting with "_" (such as a template) are skipped.
// Plain Node can't run import.meta.glob; it uses discover.ts instead.

import { categories, type Category, type ToolDeclaration } from './types';

const modules = import.meta.glob<{ tool: ToolDeclaration }>(
  ['./*/declaration.ts', '!./_*/declaration.ts'],
  { eager: true },
);

/** Every Tool, in Category order and then by position. */
export const tools: ToolDeclaration[] = Object.values(modules)
  .map((module) => module.tool)
  .sort(
    (a, b) =>
      categories.indexOf(a.category) - categories.indexOf(b.category) || a.position - b.position,
  );

/** Categories that have Tools, in their fixed order, each with its Tools. */
export function toolsByCategory(): { category: Category; tools: ToolDeclaration[] }[] {
  return categories
    .map((category) => ({ category, tools: tools.filter((tool) => tool.category === category) }))
    .filter((group) => group.tools.length > 0);
}

export function toolAt(address: string): ToolDeclaration {
  const tool = tools.find((t) => t.address === address);
  if (!tool) throw new Error(`No Tool at "${address}"`);
  return tool;
}
