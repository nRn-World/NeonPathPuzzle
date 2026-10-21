import assert from "node:assert/strict";
import test from "node:test";

import { dictionaries, LANGUAGES, upper, useLanguageStore } from "./i18n";
import { content } from "./contentText";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(",");

test("every language has every key, and the same placeholders as English", () => {
  const english = dictionaries.en;
  for (const { code } of LANGUAGES) {
    for (const key of Object.keys(english) as (keyof typeof english)[]) {
      const text = dictionaries[code][key];
      assert.ok(typeof text === "string" && text.trim().length > 0, `${code}.${key} is missing or empty`);
      assert.equal(
        placeholders(text),
        placeholders(english[key]),
        `${code}.${key} has different placeholders than English`,
      );
    }
  }
});

test("no translation leaves a language-less dictionary key behind", () => {
  const keys = Object.keys(dictionaries.en).sort();
  for (const { code } of LANGUAGES) {
    assert.deepEqual(Object.keys(dictionaries[code]).sort(), keys, `${code} has extra or missing keys`);
  }
});

test("English is the default language", () => {
  assert.equal(useLanguageStore.getState().language, "en");
});

test("upper-casing follows the language, so Turkish keeps its dotted capital i", () => {
  useLanguageStore.setState({ language: "tr" });
  assert.equal(upper("seviye"), "SEVİYE");
  useLanguageStore.setState({ language: "en" });
  assert.equal(upper("level"), "LEVEL");
});

test("content text falls back to English for the default language and translates the rest", () => {
  const item = { id: "first_steps", name: "First Steps", description: "Complete your first level", reward: { description: "Undo Shield power-up" } };
  useLanguageStore.setState({ language: "en" });
  assert.equal(content.achievement(item).name, "First Steps");
  useLanguageStore.setState({ language: "es" });
  assert.equal(content.achievement(item).name, "Primeros pasos");
  useLanguageStore.setState({ language: "en" });
});
