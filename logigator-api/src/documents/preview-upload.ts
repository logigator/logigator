import { HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../common/api-exception';
import { IMAGE_SLOTS, type ImageSlot } from '../storage/image-variants';

/** The two renders a preview upload carries, keyed by the theme each shows. */
export type PreviewSources = Record<ImageSlot, Buffer>;

/**
 * Reads a preview upload: one render per theme, in one request, because they
 * are one asset — replacing only one would leave the two previews showing
 * different circuits. Part names are the slots, so arrival order is free.
 *
 * Multipart rather than JSON: these are bytes, and base64 would inflate them by
 * a third for nothing.
 */
export async function readPreviewUpload(
  request: FastifyRequest
): Promise<PreviewSources> {
  const sources = new Map<ImageSlot, Buffer>();

  for await (const part of request.parts()) {
    if (part.type !== 'file') continue;

    if (!isSlot(part.fieldname)) {
      throw badRequest(
        `Unexpected file part "${part.fieldname}"; expected ${IMAGE_SLOTS.join(' and ')}.`
      );
    }
    if (sources.has(part.fieldname)) {
      throw badRequest(`Two parts named "${part.fieldname}".`);
    }

    // Each part has to be drained before the iterator moves on, so the buffer
    // is read here rather than collected and read later.
    const content = await part.toBuffer();
    // `toBuffer` resolves even when the stream was cut off at the size limit,
    // so the flag is all that tells a truncated render from a whole one.
    if (part.file.truncated) {
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'bad_request',
        `The ${part.fieldname} render is too large.`
      );
    }
    sources.set(part.fieldname, content);
  }

  const missing = IMAGE_SLOTS.filter((slot) => !sources.has(slot));
  if (missing.length > 0) {
    throw badRequest(`Missing the ${missing.join(' and ')} render.`);
  }

  return { light: sources.get('light')!, dark: sources.get('dark')! };
}

function isSlot(name: string): name is ImageSlot {
  return (IMAGE_SLOTS as readonly string[]).includes(name);
}

function badRequest(message: string): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'bad_request', message);
}
