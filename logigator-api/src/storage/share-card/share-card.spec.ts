import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { CARD_HEIGHT, CARD_WIDTH } from './card-layout';
import { composeShareCard, type ShareCardInput } from './share-card';

/** The circuit inside that square, and the transparent bars around it. */
const CONTENT = { width: 600, height: 240 };

/**
 * A stored render: line art on a transparent ground, contain-fit inside the
 * square the editor uploads. Drawn in the square rather than composited into
 * one, so that cropping it below yields exactly the same pixels — compositing
 * over transparency shifts the anti-aliased edges, which would make a
 * comparison fail for a reason that has nothing to do with the card.
 */
async function storedRender(size = 1024): Promise<Buffer> {
  const left = (size - CONTENT.width) / 2;
  const top = (size - CONTENT.height) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g transform="translate(${left} ${top})" stroke="#e4e4e7" stroke-width="3" fill="none"><rect x="10" y="10" width="${CONTENT.width - 20}" height="${CONTENT.height - 20}"/><path d="M10 10L${CONTENT.width - 10} ${CONTENT.height - 10}"/></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** A render with nothing on it at all, which a blank board produces. */
async function blankRender(size = 1024): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .png()
    .toBuffer();
}

function subjectWith(render: Buffer | null): ShareCardInput['subject'] {
  return { kind: 'project', componentCount: 184, wireCount: 512, render };
}

function project(over: Partial<ShareCardInput> = {}): ShareCardInput {
  return {
    name: '4-bit ALU',
    username: 'andreask',
    avatar: null,
    stars: 37,
    host: 'logigator.com',
    subject: subjectWith(null),
    ...over
  };
}

describe('the share card', () => {
  it('draws at the size every share surface expects', async () => {
    const { width, height, format } = await sharp(
      await composeShareCard(project())
    ).metadata();

    expect({ width, height, format }).toEqual({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      format: 'png'
    });
  });

  it('fits the content of a render, not its transparent padding', async () => {
    const stored = await storedRender();
    // The same circuit with most of the padding already gone. Both have to
    // compose the same card: fitting the stored square instead of its content
    // would shrink the circuit twice, and an assertion that the panel merely
    // holds *something* would never notice.
    const cropped = await sharp(stored)
      .extract({
        left: (1024 - CONTENT.width) / 2 - 4,
        top: (1024 - CONTENT.height) / 2 - 4,
        width: CONTENT.width + 8,
        height: CONTENT.height + 8
      })
      .png()
      .toBuffer();

    const [fromStored, fromCropped] = await Promise.all([
      composeShareCard(project({ subject: subjectWith(stored) })),
      composeShareCard(project({ subject: subjectWith(cropped) }))
    ]);

    expect(fromStored.equals(fromCropped)).toBe(true);
  });

  it('falls back to the bare panel when a render is nothing but padding', async () => {
    const [fromBlank, fromMissing] = await Promise.all([
      composeShareCard(project({ subject: subjectWith(await blankRender()) })),
      composeShareCard(project({ subject: subjectWith(null) }))
    ]);

    // A blank board is a state to detect, not a crash to guard: trimming one
    // answers the dimensions it was handed, exactly as a full-bleed circuit
    // does, so the emptiness is found by asking whether any pixel is opaque.
    expect(fromBlank.equals(fromMissing)).toBe(true);
  });

  it('draws a document whose text is markup', async () => {
    // Every string here is the author's. Unescaped, the `<` would be markup
    // inside our own renderer and the characters XML forbids would make
    // libxml2 reject the document, so one hostile name would take the route
    // down — permanently, for that document, until somebody renamed it.
    //
    // `\uFFFE` and `\uFFFF` are in here beside the control character because
    // nothing upstream filters them either: the name schema is a length rather
    // than a character set, and both survive Postgres intact.
    const card = await composeShareCard({
      name: '</text><image href="x"/>\u0001\ufffe\uffff',
      username: 'a & b',
      avatar: null,
      stars: 1,
      host: 'logigator.com',
      subject: {
        kind: 'component',
        symbol: '<&>',
        numInputs: 2,
        numOutputs: 1,
        labels: ['<a', '&b', "'s"]
      }
    });

    const { width } = await sharp(card).metadata();
    expect(width).toBe(CARD_WIDTH);
  });

  it('keeps the characters XML allows, including the ones that look hostile', async () => {
    // The strip is `Char`, not "anything unusual": `U+FDD0` is a noncharacter
    // that XML permits, and a name carrying one has to keep it rather than
    // silently lose a letter.
    const card = await composeShareCard(
      project({ name: `a\ufdd0b\ufffd`, username: 'z\tz' })
    );

    const { width } = await sharp(card).metadata();
    expect(width).toBe(CARD_WIDTH);
  });

  it('draws a component from its symbol rather than from a render', async () => {
    const wide = await composeShareCard({
      ...project(),
      subject: {
        kind: 'component',
        symbol: 'ADD',
        numInputs: 3,
        numOutputs: 2,
        labels: ['A', 'B', 'CIN', 'S', 'COUT']
      }
    });

    // Past what the panel can pitch, the ports are not drawn at all and the
    // stat strip is what carries the arity — a different picture, never a
    // symbol with stubs running out of the frame.
    const collapsed = await composeShareCard({
      ...project(),
      subject: {
        kind: 'component',
        symbol: 'ADD',
        numInputs: 12,
        numOutputs: 2,
        labels: []
      }
    });

    expect(wide.equals(collapsed)).toBe(false);
  });
});
