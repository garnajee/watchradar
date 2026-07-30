import en from "../locales/en.json";
import fr from "../locales/fr.json";
import type { Locale } from "../types";

type NestedKeys<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : `${Key}.${NestedKeys<T[Key]>}`;
}[keyof T & string];

export type TranslationKey = NestedKeys<typeof en>;
export type TranslationParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const dictionaries = { en, fr } as const;

function lookup(dictionary: unknown, key: string): string | undefined {
  let current = dictionary;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params: TranslationParams = {}
): string {
  const template = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key) ?? key;
  return Object.entries(params).reduce(
    (message, [name, value]) => message.split(`{{${name}}}`).join(String(value)),
    template
  );
}

export function translationKeys(dictionary: unknown): string[] {
  const keys: string[] = [];
  function visit(value: unknown, prefix: string): void {
    if (typeof value === "string") {
      keys.push(prefix);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, nested] of Object.entries(value)) {
      visit(nested, prefix ? `${prefix}.${key}` : key);
    }
  }
  visit(dictionary, "");
  return keys.sort();
}

export const localeDictionaries = dictionaries;
