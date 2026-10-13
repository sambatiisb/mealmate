import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        mobileNumber: { label: "Mobile number" },
      },
      authorize: async (credentials) => {
        const mobile = credentials?.mobileNumber;
        if (typeof mobile !== "string" || !mobile.trim()) return null;

        const user = await prisma.user.findUnique({
          where: { mobileNumber: mobile.trim() },
        });
        if (!user) return null;

        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          mobileNumber: user.mobileNumber,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.mobileNumber = (user as { mobileNumber?: string }).mobileNumber;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.mobileNumber = token.mobileNumber as string;
      }
      return session;
    },
  },
});
