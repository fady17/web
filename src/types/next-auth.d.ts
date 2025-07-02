import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as NextAuthJWT } from "next-auth/jwt"; // Use an alias to avoid naming conflict if you also have a local JWT interface

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    accessToken?: string;
    idToken?: string;
    error?: "RefreshAccessTokenError" | "RefreshFailedNoToken" | string; // Allow more generic string for other errors
    user: {
      id?: string | null; // id is usually string (sub claim)
    } & DefaultSession["user"]; // Extend default user properties (name, email, image)
  }

  /** The OAuth profile returned from your provider */
  interface User extends DefaultUser {
    // Add properties from your RallyIdPProfile that you return in the profile callback
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number; 
    // id is already part of DefaultUser but ensure it's string
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and sent to the `session` callback */
  interface JWT extends NextAuthJWT { // Extend NextAuth's JWT
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number; // Store as milliseconds since epoch
    idToken?: string;
    userId?: string; // This will hold the 'sub' claim
    error?: "RefreshAccessTokenError" | "RefreshFailedNoToken" | string;
    // Store user details that you want to pass to the session
    user?: {
        id?: string | null;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
  }
}