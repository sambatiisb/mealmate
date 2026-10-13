"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { captureServerEvent } from "@/lib/posthog-server";

export interface AuthActionState {
  error?: string;
}

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
});

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    mobileNumber: formData.get("mobileNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details" };
  }

  const { firstName, lastName, mobileNumber } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { mobileNumber } });
  if (existing) {
    return { error: "An account with this number already exists — try logging in" };
  }

  // Auto-generate a unique internal username from the mobile number
  const base = "m_" + mobileNumber.replace(/\D/g, "");
  let username = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}_${suffix++}`;
  }

  const user = await prisma.user.create({
    data: { firstName, lastName, username, mobileNumber },
  });

  await captureServerEvent(user.id, "user_signed_up", { mobileNumber });

  try {
    await signIn("credentials", { mobileNumber, redirectTo: "/home-choice" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — try logging in" };
    }
    throw error;
  }

  return {};
}

const loginSchema = z.object({
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
});

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    mobileNumber: formData.get("mobileNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter your mobile number" };
  }

  try {
    await signIn("credentials", {
      mobileNumber: parsed.data.mobileNumber,
      redirectTo: "/home-choice",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "No account found with that number — try signing up" };
    }
    throw error;
  }

  return {};
}
