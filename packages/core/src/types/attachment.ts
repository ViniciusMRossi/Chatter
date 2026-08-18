export type AttachmentKind = "image" | "video" | "file";

/**
 * Inbound attachments (on `Message`) always use the `{ url }` variant — adapters resolve any
 * provider-specific reference to a ready-to-use download URL before constructing one. Outbound
 * attachments (on `SendInput`) may use either variant.
 */
export type AttachmentSource = { readonly url: string } | { readonly data: Buffer };

export interface Attachment {
  readonly kind: AttachmentKind;
  readonly source: AttachmentSource;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}
