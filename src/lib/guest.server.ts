export type GuestIdentity = {
  guestId: string;
  email: string;
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

export function guestIdentityFromValues(email: unknown, guestId: unknown): GuestIdentity | null {
  const normalizedEmail = normalizeEmail(email);
  const normalizedGuestId = normalizeGuestId(guestId);
  if (!normalizedEmail || !normalizedGuestId) return null;
  return { email: normalizedEmail, guestId: normalizedGuestId };
}

export function guestIdentityFromRequest(request: Request): GuestIdentity | null {
  const url = new URL(request.url);
  return guestIdentityFromValues(url.searchParams.get("email"), url.searchParams.get("guest_id"));
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
