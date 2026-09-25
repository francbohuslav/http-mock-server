import { normalizeRule, type Rule } from "../config/normalize";
import type { RawRule } from "../config/raw-config";

/**
 * Returns the first rule (in key order) whose regex matches the URL. The key "" matches everything.
 */
export function matchRule(rules: Record<string, RawRule>, url: string): Rule | undefined {
  for (const [mask, rawRule] of Object.entries(rules)) {
    if (new RegExp(mask).test(url)) {
      return normalizeRule(mask, rawRule);
    }
  }
  return undefined;
}
