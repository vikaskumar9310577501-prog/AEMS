import crypto from "crypto";
import nodemailer from "nodemailer";
import { readAppData } from "./dataStore.js";
import { APP_NAME, APP_SHORT_NAME } from "../src/lib/constants.js";
import { buildOtpEmailHtml } from "./emailTemplates.js";
import { getEnv } from "./env.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_LENGTH = 6;

interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  sendCount: number;
}

const otpStore = new Map<string, OtpRecord>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function getMailer() {
  const user = getEnv("SMTP_EMAIL");
  const pass = getEnv("SMTP_PASSWORD");
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: getEnv("SMTP_HOST") || "smtp.gmail.com",
    port: parseInt(getEnv("SMTP_PORT") || "587", 10),
    secure: getEnv("SMTP_SECURE") === "true",
    auth: { user, pass },
  });
}

function getFromAddress() {
  const from =
    getEnv("OTP_FROM_EMAIL") || "verify.software2040@pgel.in";
  return `"${APP_NAME}" <${from}>`;
}

export function findRegisteredUser(email: string) {
  const normalized = normalizeEmail(email);
  const data = readAppData();
  const local = data.users.find((u) => u.email === normalized);
  if (local) return local;

  return null;
}

export async function requestOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "Valid email is required" };
  }

  const user = findRegisteredUser(normalized);
  if (!user) {
    return { ok: false, error: "This email is not registered. Contact your IT administrator." };
  }

  const now = Date.now();
  const existing = otpStore.get(normalized);
  if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return { ok: false, error: `Please wait ${waitSec}s before requesting another code.` };
  }

  if (existing && existing.sendCount >= 5 && now - existing.lastSentAt < 15 * 60 * 1000) {
    return { ok: false, error: "Too many OTP requests. Try again in 15 minutes." };
  }

  const otp = generateOtp();
  const transporter = getMailer();
  if (!transporter) {
    return {
      ok: false,
      error:
        "SMTP fallback is not configured. OTP is normally sent via Google Apps Script (verify.software2040@pgel.in). Set GAS_WEBAPP_URL in .env, or set OTP_USE_SMTP=true with SMTP_EMAIL and SMTP_PASSWORD.",
    };
  }

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: normalized,
      subject: `${otp} - Your ${APP_SHORT_NAME} login code`,
      html: buildOtpEmailHtml(otp, Math.floor(OTP_EXPIRY_MS / 60000)),
      text: `Your ${APP_NAME} login code is ${otp}. It expires in ${Math.floor(OTP_EXPIRY_MS / 60000)} minutes.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send email";
    console.error("OTP email error:", msg);
    return { ok: false, error: "Could not send OTP email. Please try again." };
  }

  otpStore.set(normalized, {
    otp,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
    lastSentAt: now,
    sendCount: (existing?.sendCount || 0) + 1,
  });

  return { ok: true };
}

export function verifyOtp(email: string, otp: string): { ok: boolean; error?: string } {
  const normalized = normalizeEmail(email);
  const code = String(otp || "").trim();
  if (!code || code.length !== OTP_LENGTH) {
    return { ok: false, error: "Enter the 6-digit OTP" };
  }

  const record = otpStore.get(normalized);
  if (!record) {
    return { ok: false, error: "OTP expired or not requested. Request a new code." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return { ok: false, error: "OTP has expired. Request a new code." };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(normalized);
    return { ok: false, error: "Too many failed attempts. Request a new OTP." };
  }

  if (record.otp !== code) {
    record.attempts += 1;
    return { ok: false, error: `Invalid OTP. ${MAX_VERIFY_ATTEMPTS - record.attempts} attempts left.` };
  }

  otpStore.delete(normalized);
  return { ok: true };
}
