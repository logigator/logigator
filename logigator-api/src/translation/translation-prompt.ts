/**
 * The detection and translation rules of the text analysis prompt.
 *
 * It leans one way on purpose. A field left untranslated costs a reader one
 * click on the original; a label, part number or project name translated
 * wrongly misleads them. So wherever the model is unsure, it is asked to keep
 * the text.
 *
 * It changes together with the reply part in `translation-reply` and with
 * `translation-check`, which is what the model's answer is read against.
 */
export const TRANSLATION_PROMPT_SECTION = `Language, for name and description separately:
- The ISO 639-1 code of the language it is written in, any language.
- "zxx" when there is nothing to translate: it is empty, or only labels, proper names, abbreviations, part numbers, numbers, code or symbols, or no language would write it differently.
- The hint only decides between languages that spell the text identically.

Translations, per field and language:
- null for the field's own language, for every language of a "zxx" field, and wherever the text would stay the same.
- When unsure whether something should change, keep it as written: null, or "zxx" for the whole field. A missing translation costs a reader one click; a wrongly translated label, part number or name misleads them.
- Keep as written: Markdown syntax, code, URLs, link destinations, image sources, labels, abbreviations (CPU, LED), part numbers (74HC595), numbers, and names of projects, people and products.
- A label marks one pin, signal or gate on the circuit (A, Cin, CLK, Q); so does a gate symbol alone (AND, XOR) in a title, table or formula. A kind of component in words is ordinary words, with the usual term: "half adder", "flip-flop", "OR gate".
- Most titles stay. Translate one only when a reader of that language would clearly write its ordinary words differently, within 20 characters. Labels, abbreviations, part numbers and names in a title stay as written while the ordinary words around them change.
- Address the reader as "du" in German, "vous" in French, "tú" in Spanish.
- A description keeps every heading, list item, table cell, code block and link, in order; only the prose in and around them changes.`;
