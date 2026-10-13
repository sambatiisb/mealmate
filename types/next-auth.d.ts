import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mobileNumber: string;
    } & DefaultSession["user"];
  }

  interface User {
    mobileNumber?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    mobileNumber: string;
  }
}
