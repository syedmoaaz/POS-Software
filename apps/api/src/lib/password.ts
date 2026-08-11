import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

const ROUNDS = env.NODE_ENV === "test" ? 4 : 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}
