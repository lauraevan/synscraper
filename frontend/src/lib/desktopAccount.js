const ACCOUNT_KEY = "synflix_desktop_account_v1";
const SESSION_KEY = "synflix_desktop_session_v1";
const PBKDF2_ITERATIONS = 120000;

const safeParse = (value, fallback = null) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const toBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
};

const fromBase64 = (value) => {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const randomSalt = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return toBase64(bytes);
};

const deriveVerifier = async (password, saltBase64) => {
  if (!window.crypto?.subtle) throw new Error("Secure credential storage is not available on this device.");
  const encoder = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(saltBase64),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256
  );
  return toBase64(new Uint8Array(bits));
};

const publicAccount = (account) => account ? ({
  email: account.email,
  displayName: account.displayName,
  createdAt: account.createdAt,
}) : null;

export const getDesktopAccount = () => {
  if (typeof window === "undefined") return null;
  return publicAccount(safeParse(window.localStorage.getItem(ACCOUNT_KEY)));
};

export const hasDesktopAccount = () => Boolean(getDesktopAccount());

export const isDesktopSignedIn = () => {
  if (typeof window === "undefined") return false;
  const account = safeParse(window.localStorage.getItem(ACCOUNT_KEY));
  const session = safeParse(window.localStorage.getItem(SESSION_KEY));
  return Boolean(account?.email && session?.email === account.email);
};

export const createDesktopAccount = async ({ displayName, email, password }) => {
  const cleanName = String(displayName || "").trim();
  const cleanEmail = normalizeEmail(email);
  if (cleanName.length < 2) throw new Error("Enter a display name with at least 2 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
  if (String(password || "").length < 8) throw new Error("Use at least 8 characters for your password.");

  const salt = randomSalt();
  const verifier = await deriveVerifier(password, salt);
  const account = {
    email: cleanEmail,
    displayName: cleanName.slice(0, 40),
    salt,
    verifier,
    createdAt: Date.now(),
  };
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email: account.email, signedInAt: Date.now() }));
  window.dispatchEvent(new CustomEvent("synflix-desktop-account", { detail: publicAccount(account) }));
  return publicAccount(account);
};

export const signInDesktopAccount = async ({ email, password }) => {
  const account = safeParse(window.localStorage.getItem(ACCOUNT_KEY));
  if (!account?.email || !account?.salt || !account?.verifier) throw new Error("No SynFlix account exists on this device yet.");
  if (normalizeEmail(email) !== account.email) throw new Error("That email does not match the account on this device.");
  const verifier = await deriveVerifier(String(password || ""), account.salt);
  if (verifier !== account.verifier) throw new Error("Incorrect password.");
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email: account.email, signedInAt: Date.now() }));
  window.dispatchEvent(new CustomEvent("synflix-desktop-account", { detail: publicAccount(account) }));
  return publicAccount(account);
};

export const signOutDesktopAccount = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("synflix-desktop-account", { detail: null }));
};
