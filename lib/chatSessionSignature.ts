type SignatureMessage = { role: string; content: unknown };
type SignatureSession = { title?: string; messages?: SignatureMessage[] };

/**
 * Cheap content fingerprint for a chat session (title + messages only — cards
 * and mealResult are local-only and never synced). Used to break the
 * hydrate -> sync -> invalidate -> sync loop: identical cloud content must not
 * trigger another upsert just because the list identity changed.
 */
export function chatSessionSignature(session: SignatureSession): string {
  const messages = session.messages ?? [];
  const payload = [
    session.title ?? "",
    ...messages.map((m) => {
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? null);
      return `${m.role}:${content}`;
    }),
  ].join("\n");

  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return `${messages.length}:${hash}`;
}
