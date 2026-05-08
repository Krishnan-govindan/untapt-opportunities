export type GuestIdentity = {
  guestId: string;
  email: string | null;
};

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function normalizeGuestId(guestId: unknown): string | null {
  if (typeof guestId !== "string") return null;
  const normalized = guestId.trim();
  if (normalized.length < 8 || normalized.length > 120) return null;
  return normalized;
}

export function guestIdentityFromValues(
  email: unknown,
  guestId: unknown,
  options: { requireEmail?: boolean } = {},
): GuestIdentity | null {
  const normalizedGuestId = normalizeGuestId(guestId);
  if (!normalizedGuestId) return null;

  const rawEmail = typeof email === "string" ? email.trim() : "";
  const normalizedEmail = rawEmail ? normalizeEmail(rawEmail) : null;
  if (rawEmail && !normalizedEmail) return null;
  if (options.requireEmail && !normalizedEmail) return null;

  return { email: normalizedEmail, guestId: normalizedGuestId };
}

export function guestIdentityFromRequest(
  request: Request,
  options: { requireEmail?: boolean } = {},
): GuestIdentity | null {
  const url = new URL(request.url);
  return guestIdentityFromValues(
    url.searchParams.get("email"),
    url.searchParams.get("guest_id"),
    options,
  );
}

export function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
