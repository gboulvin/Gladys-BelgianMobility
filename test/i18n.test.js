// -----------------------------------------------------------------------------
// The integration speaks English, French, German and Spanish: every text it
// sends, and every text of the manifest, exists in the four languages.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES, MESSAGES, t, tl } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('every message exists in the four languages, with the same placeholders', () => {
  for (const [key, entry] of Object.entries(MESSAGES)) {
    assert.deepEqual(Object.keys(entry).sort(), [...LANGUAGES].sort(), `message ${key}`);
    for (const language of LANGUAGES) {
      assert.ok(entry[language].length > 0, `message ${key}.${language} is empty`);
      assert.deepEqual(placeholders(entry[language]), placeholders(entry.en), `${key}.${language}`);
    }
  }
});

test('t substitutes the placeholders, tl picks one language', () => {
  assert.deepEqual(t('delay_badge', { minutes: 7 }), {
    en: '+7 min',
    fr: '+7 min',
    de: '+7 Min.',
    es: '+7 min',
  });
  assert.equal(tl('fr', 'platform', { platform: 3 }), 'Voie 3');
  assert.equal(tl('nl', 'platform', { platform: 3 }), 'Platform 3', 'English otherwise');
  assert.throws(() => t('nope'), /Unknown message key/);
});

// Every multi-language object of the manifest: an object whose keys are all
// language codes.
function multiLanguageTexts(node, path = '$', found = []) {
  if (Array.isArray(node)) {
    node.forEach((child, index) => multiLanguageTexts(child, `${path}[${index}]`, found));
  } else if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    if (keys.length > 0 && keys.every((key) => /^[a-z]{2}$/.test(key))) {
      found.push({ path, value: node });
    } else {
      for (const [key, child] of Object.entries(node)) {
        multiLanguageTexts(child, `${path}.${key}`, found);
      }
    }
  }
  return found;
}

test('every text of the manifest exists in the four languages', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50);
  for (const { path, value } of texts) {
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), path);
    for (const language of LANGUAGES) {
      assert.ok(value[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the user documentation exists in the four languages', async () => {
  for (const language of LANGUAGES) {
    const doc = await readFile(new URL(`../docs/${language}.md`, import.meta.url), 'utf8');
    // The store asks for 300 characters at least (en and fr are mandatory).
    assert.ok(doc.length >= 300, `docs/${language}.md is too short`);
  }
});
