import NextAuth, { AuthOptions, User as NextAuthUser } from "next-auth";
import { JWT as NextAuthJWT } from "next-auth/jwt";
import { OAuthConfig } from "next-auth/providers/oauth";

// RallyIdPProfile from your original file
interface RallyIdPProfile extends Record<string, any> {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  picture?: string;
}

// Using augmented types from next-auth.d.ts
// No need to redefine ExtendedUser or ExtendedJWT here if next-auth.d.ts is correctly picked up by TypeScript.
// If you still get errors, it means next-auth.d.ts is not being seen. Ensure it's in the root or a recognized `types` folder.

async function refreshAccessToken(token: NextAuthJWT): Promise<NextAuthJWT> { // Use NextAuthJWT from augmentation
  try {
    if (!token.refreshToken) { // refreshToken is now part of the augmented NextAuthJWT
      console.error("[refreshAccessToken] No refresh token available.");
      throw new Error("No refresh token available");
    }

    const url = `${process.env.RALLY_IDP_ISSUER}/connect/token`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.RALLY_IDP_CLIENT_ID as string,
        client_secret: process.env.RALLY_IDP_CLIENT_SECRET as string,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string, // Cast if TS still unsure
      }),
      method: "POST",
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error("[refreshAccessToken] Error refreshing token:", refreshedTokens);
      // If refresh fails, clear tokens to force re-login or handle specific errors
      return {
        ...token,
        error: "RefreshAccessTokenError",
        accessToken: undefined, // Clear expired access token
        accessTokenExpires: undefined,
        // refreshToken: undefined, // Optionally clear refresh token if it's single-use or also invalid
      };
    }

    console.log("[refreshAccessToken] Tokens refreshed successfully.");

    const newExpiresIn = refreshedTokens.expires_in as number; // Assume expires_in is number

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + newExpiresIn * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, 
      error: undefined,
    };
  } catch (error) {
    console.error("[refreshAccessToken] Catch block:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
      accessToken: undefined, // Clear expired access token on error too
      accessTokenExpires: undefined,
    };
  }
}

export const authOptions: AuthOptions = {
  providers: [
    {
      id: "rallyidp",
      name: "Rally Motors IdP",
      type: "oauth",
      issuer: process.env.RALLY_IDP_ISSUER,
      wellKnown: `${process.env.RALLY_IDP_ISSUER}/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: "openid profile email automotiveservices.api.read_public automotiveservices.api.user.interact ",//remeber to add offline_access after you reseed the clients
        },
      },
      clientId: process.env.RALLY_IDP_CLIENT_ID,
      clientSecret: process.env.RALLY_IDP_CLIENT_SECRET,
      checks: ["pkce", "state"],
      idToken: true, // Process the ID token
      profile(profile: RallyIdPProfile, tokens: any) { // `tokens` here are from the OAuth provider
        // console.log("[RallyIdP Profile Callback] IdP Profile:", profile);
        // console.log("[RallyIdP Profile Callback] OAuth Tokens:", tokens);
        
        let expires_at_ms: number | undefined = undefined;
        if (tokens.expires_at) { // tokens.expires_at is usually in seconds since epoch
            expires_at_ms = tokens.expires_at * 1000;
        } else if (tokens.expires_in) { // tokens.expires_in is usually in seconds from now
            expires_at_ms = Date.now() + (tokens.expires_in as number) * 1000;
        }

        // This returned object becomes the `user` parameter in the `jwt` callback for the first time
        return {
          id: profile.sub, // Becomes token.userId and session.user.id
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture ?? null,
          // Pass along token data needed by the JWT callback
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token, // Ensure IdP sends this
          accessTokenExpires: expires_at_ms,
        };
      },
    } as OAuthConfig<RallyIdPProfile>,
  ],
  callbacks: {
    async jwt({ token, user, account }) { // token is NextAuthJWT (augmented), user is NextAuthUser (augmented)
      // Initial sign in: account and user are passed.
      // `user` here is the object returned from your `profile()` callback.
      if (account && user) {
        // console.log("[JWT Callback] Initial sign-in.");
        token.accessToken = user.accessToken; // From profile()
        token.idToken = user.idToken;         // From profile()
        token.refreshToken = user.refreshToken; // From profile()
        token.accessTokenExpires = user.accessTokenExpires; // From profile()
        token.userId = user.id; // This is profile.sub
        
        // Store essential user details in the JWT token to pass to the session
        token.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
        };
        token.error = undefined; // Clear any previous error
        // console.log("[JWT Callback] Token after initial sign-in:", token);
        return token;
      }

      // If token has a critical error (e.g., refresh failed and couldn't recover), return it as is.
      if (token.error === "RefreshAccessTokenError" || token.error === "RefreshFailedNoToken") {
        // console.warn("[JWT Callback] Token has unrecoverable error:", token.error);
        return token; 
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        // console.log("[JWT Callback] Access token still valid.");
        return token;
      }

      // Access token has expired, or is about to (no buffer here, could add one)
      // console.log("[JWT Callback] Access token expired or not present. Attempting refresh...");
      if (!token.refreshToken) {
        console.warn("[JWT Callback] No refresh token available. Cannot refresh access token.");
        token.error = "RefreshFailedNoToken"; // Set error
        return token;
      }
      
      // console.log("[JWT Callback] Calling refreshAccessToken.");
      return refreshAccessToken(token);
    },
    async session({ session, token }) { // token is NextAuthJWT (augmented), session is Session (augmented)
      // console.log("[Session Callback] Received token for session:", token);
      
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.error = token.error; // Pass error state to client session

      // Ensure session.user object exists
      if (!session.user) {
        session.user = {};
      }

      // Populate session.user from the details stored in the JWT token
      if (token.user) {
        session.user.id = token.user.id;
        session.user.name = token.user.name;
        session.user.email = token.user.email;
        session.user.image = token.user.image;
      } else {
        // Fallback if token.user is not populated as expected (should not happen with current jwt logic)
        session.user.id = token.userId || token.sub;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
      }
      
      // console.log("[Session Callback] Returning session:", session);
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
// // app/api/auth/[...nextauth]/route.ts
// import NextAuth, { AuthOptions } from "next-auth";
// import { OAuthConfig } from "next-auth/providers/oauth";
// // import { OAuthConfig, OAuthUserConfig } from "next-auth/OIDC";

// // Define the structure of the profile object we expect from Duende IS
// // (based on standard OIDC claims for openid, profile, email scopes)
// interface RallyIdPProfile extends Record<string, any> {
//   sub: string;
//   name?: string;
//   email?: string;
//   email_verified?: boolean;
//   preferred_username?: string; // Often included
//   picture?: string;
//   // Add any other custom claims you expect from your IdP
// }

// export const authOptions: AuthOptions = {
//   providers: [
//     { // This is our "custom" OIDC provider configuration
//       id: "rallyidp",
//       name: "Rally Motors IdP",
//       type: "oauth",
//       // Provide the issuer. NextAuth/openid-client might use this to find .well-known
//       // If not, we can explicitly provide all endpoints.
//       issuer: process.env.RALLY_IDP_ISSUER, // e.g., "https://localhost:7223"
      
//       // Explicitly use wellKnown if the built-in provider wasn't picking it up correctly
//       // or if we want to be absolutely sure. openid-client will use this to fetch
//       // authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri etc.
//       wellKnown: `${process.env.RALLY_IDP_ISSUER}/.well-known/openid-configuration`,

//       // We still need to specify the authorization object to override/ensure the scope
//      authorization: {
//   params: {
//     scope: "openid profile email automotiveservices.api.read_public automotiveservices.api.user.interact",
//   },
// },

//       // While wellKnown should provide these, if issues persist, you can specify them:
//       // token: `${process.env.RALLY_IDP_ISSUER}/connect/token`,
//       // userinfo: `${process.env.RALLY_IDP_ISSUER}/connect/userinfo`,

//       clientId: process.env.RALLY_IDP_CLIENT_ID, // "RALLY_MOTORS_GROUP"
//       clientSecret: process.env.RALLY_IDP_CLIENT_SECRET,

//       checks: ["pkce", "state"], // Standard security checks

//       // Tell NextAuth to expect and utilize the ID token
//       // Your IdP client `RALLY_MOTORS_GROUP` has AlwaysIncludeUserClaimsInIdToken = true
//       idToken: true,

//       async profile(profile: RallyIdPProfile, tokens: any) {
//         // 'profile' is the set of claims from the IdP (either UserInfo or decoded ID Token)
//         // 'tokens' contains access_token, id_token, refresh_token (if configured)
//         console.log("[RallyIdP Profile Callback] IdP Profile:", profile);
//         console.log("[RallyIdP Profile Callback] Tokens:", tokens);

//         return {
//           id: profile.sub, // Standard unique identifier
//           name: profile.name ?? profile.preferred_username,
//           email: profile.email,
//           image: profile.picture ?? null,
//           accessToken: tokens.access_token, // Make sure to pass the access token
//           idToken: tokens.id_token,         // And ID token
//           // You could add other claims from 'profile' if needed for the 'user' object in the 'jwt' callback
//         };
//       },
//     } as OAuthConfig<RallyIdPProfile>, // Type assertion for custom provider
//   ],
//   callbacks: {
//     async jwt({ token, user, account, profile }) {
//       // 'user' is the object from the 'profile' callback on initial sign-in
//       // 'account' contains provider details like access_token on initial sign-in
//       if (account && user) {
//         token.accessToken = user.accessToken; // 'user' now has accessToken from our profile callback
//         token.idToken = user.idToken;       // and idToken
//         token.userId = user.id;             // This is profile.sub
//         token.name = user.name;
//         token.email = user.email;
//         token.picture = user.image;
//       }
//       // console.log("[JWT Callback] Token:", token);
//       return token;
//     },
//     async session({ session, token }) {
//       // 'token' is from the `jwt` callback
//       session.accessToken = token.accessToken as string;
//       session.idToken = token.idToken as string;
//       if (token.userId) {
//         // Ensure session.user.id is consistently populated
//         if (!session.user) session.user = {}; // Initialize session.user if it doesn't exist
//         session.user.id = token.userId as string;
//       } else if (token.sub) {
//         if (!session.user) session.user = {};
//         session.user.id = token.sub as string;
//       }
      
//       // Populate other session.user fields
//       if (token.name && session.user) session.user.name = token.name as string;
//       if (token.email && session.user) session.user.email = token.email as string;
//       if (token.picture && session.user) session.user.image = token.picture as string;
      
//       // console.log("[Session Callback] Session:", session);
//       return session;
//     },
//   },
//   session: {
//     strategy: "jwt",
//   },
//   secret: process.env.NEXTAUTH_SECRET,
//   debug: process.env.NODE_ENV === "development",
// };

// const handler = NextAuth(authOptions);
// export { handler as GET, handler as POST };