// src/lib/anonymousUser.ts
import { 
    ANONYMOUS_API_PATHS, 
    ANONYMOUS_SESSION_TOKEN_HEADER,
    DecodedAnonymousSessionToken // Import the type from your types file
} from '@/types/anonymous';
import { APIError } from '@/types/api'; // Assuming you have this

const ANONYMOUS_TOKEN_STORAGE_KEY = 'anonymousSessionToken';

// CRITICAL: This must point to your AutomotiveServices.Api backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039'; 

class AnonymousUserManager {
  private storage = {
    getItem: async (key: string): Promise<string | null> => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
    setItem: async (key: string, value: string): Promise<void> => { if (typeof window !== 'undefined') localStorage.setItem(key, value); },
    removeItem: async (key: string): Promise<void> => { if (typeof window !== 'undefined') localStorage.removeItem(key); },
  };

  private _currentAnonymousToken: string | null = null;
  private _decodedTokenPayload: DecodedAnonymousSessionToken | null = null;
  
  private _isInitialized: boolean = false;
  private _initializingPromise: Promise<void> | null = null;
  private _isFetchingTokenPromise: Promise<string | null> | null = null;

  constructor() {
    // Eagerly start the initialization process.
    // Subsequent calls to public methods will await this promise if it's still pending.
    this.ensureInitialized();
  }

  // Ensures initialize() is called only once and subsequent calls await its completion.
  private async ensureInitialized(): Promise<void> {
    if (this._isInitialized) return;
    if (this._initializingPromise) return this._initializingPromise;

    this._initializingPromise = this.initialize().finally(() => {
        this._initializingPromise = null; // Clear promise once resolved/rejected
    });
    return this._initializingPromise;
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
        this._isInitialized = true; // Mark initialized in non-browser envs
        return;
    }

    console.log("AnonymousUserManager: Initializing...");
    try {
        const tokenFromStorage = await this.storage.getItem(ANONYMOUS_TOKEN_STORAGE_KEY);
        if (tokenFromStorage) {
            this.decodeAndStorePayload(tokenFromStorage); // This updates _decodedTokenPayload
            if (this.isTokenExpired(this._decodedTokenPayload)) {
                console.warn("AnonymousUserManager: Token from storage is expired. Clearing and fetching new.");
                await this.clearCurrentAnonymousSession(); // Clears _currentAnonymousToken & _decodedTokenPayload
                await this.fetchAndStoreAnonymousToken(); // Fetches new and updates internal state
            } else {
                this._currentAnonymousToken = tokenFromStorage; // Valid token from storage
                console.log("AnonymousUserManager: Loaded valid token from storage.");
            }
        } else {
            console.log("AnonymousUserManager: No token in storage. Fetching new one.");
            await this.fetchAndStoreAnonymousToken();
        }
    } catch (error) {
        console.error("AnonymousUserManager: Error during initialization:", error);
        // Ensure state is clean if initialization fails
        this._currentAnonymousToken = null;
        this._decodedTokenPayload = null;
    }
    this._isInitialized = true;
    console.log("AnonymousUserManager: Initialization complete.");
  }
  
  private decodeAndStorePayload(token: string): void {
    if (!token) {
        this._decodedTokenPayload = null;
        return;
    }
    try {
      const payloadBase64Url = token.split('.')[1];
      if (!payloadBase64Url) {
        throw new Error("Invalid token format: Missing payload.");
      }
      const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = decodeURIComponent(
        atob(payloadBase64) // Browser's built-in Base64 decoder
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      this._decodedTokenPayload = JSON.parse(payloadJson) as DecodedAnonymousSessionToken;
    } catch (error) {
      console.error("AnonymousUserManager: Error decoding token:", error);
      this._decodedTokenPayload = null;
    }
  }
  
  private isTokenExpired(payload: DecodedAnonymousSessionToken | null): boolean {
    if (!payload || !payload.exp) {
      return true; // No payload or no expiry claim means it's invalid/expired for our purposes
    }
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const bufferSeconds = 60; // e.g., 60 seconds buffer
    return payload.exp < (nowInSeconds + bufferSeconds);
  }

  public async fetchAndStoreAnonymousToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    // Prevent concurrent fetch attempts
    if (this._isFetchingTokenPromise) {
      console.log("AnonymousUserManager: Token fetch already in progress, waiting...");
      return this._isFetchingTokenPromise;
    }

    this._isFetchingTokenPromise = (async () => {
        try {
          console.log(`AnonymousUserManager: Fetching new anonymous session token from ${API_BASE_URL}${ANONYMOUS_API_PATHS.SESSIONS_CREATE}`);
          const response = await fetch(`${API_BASE_URL}${ANONYMOUS_API_PATHS.SESSIONS_CREATE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`AnonymousUserManager: Error fetching anonymous token: ${response.status} ${response.statusText}`, errorText);
            throw new APIError(response.status, response.statusText, `Failed to fetch anonymous token: ${errorText}`, `${API_BASE_URL}${ANONYMOUS_API_PATHS.SESSIONS_CREATE}`);
          }

          const data = await response.json();
          const token = data.anonymousSessionToken;

          if (token && typeof token === 'string') {
            await this.storage.setItem(ANONYMOUS_TOKEN_STORAGE_KEY, token);
            this._currentAnonymousToken = token;
            this.decodeAndStorePayload(token); // Update decoded payload
            console.log("AnonymousUserManager: New anonymous session token fetched and stored successfully.");
            return token;
          } else {
            console.error("AnonymousUserManager: Invalid token format received:", data);
            throw new Error("Invalid token format from API");
          }
        } catch (error) {
          console.error("AnonymousUserManager: Exception during token fetch:", error);
          // Clear potentially corrupt state on error
          this._currentAnonymousToken = null;
          this._decodedTokenPayload = null;
          return null;
        } finally {
            this._isFetchingTokenPromise = null; // Release lock
        }
    })();
    return this._isFetchingTokenPromise;
  }

  public async getValidAnonymousToken(): Promise<string | null> {
    await this.ensureInitialized(); // Crucial: wait for initial load/fetch attempt

    if (!this._currentAnonymousToken || this.isTokenExpired(this._decodedTokenPayload)) {
      console.log("AnonymousUserManager: No valid token or token expired, attempting to fetch new one.");
      return await this.fetchAndStoreAnonymousToken(); // This will update _currentAnonymousToken and _decodedTokenPayload
    }
    return this._currentAnonymousToken;
  }
  
  public async getAnonymousId(): Promise<string | null> {
    await this.ensureInitialized();
    // Ensure token is valid before extracting ID
    const token = await this.getValidAnonymousToken(); 
    if (token && this._decodedTokenPayload) { // _decodedTokenPayload should be fresh if token is
        return this._decodedTokenPayload.anon_id;
    }
    return null;
  }

  // Method for the hook to get the already decoded payload
  public getDecodedPayloadInternal(): DecodedAnonymousSessionToken | null {
      // No need to await ensureInitialized here if methods calling it already do.
      // However, ensuring the token isn't stale before returning payload is good.
      if (this._currentAnonymousToken && !this.isTokenExpired(this._decodedTokenPayload)) {
          return this._decodedTokenPayload;
      }
      return null; 
  }

  public async clearCurrentAnonymousSession(): Promise<void> {
    if (typeof window === 'undefined') return;
    await this.storage.removeItem(ANONYMOUS_TOKEN_STORAGE_KEY);
    this._currentAnonymousToken = null;
    this._decodedTokenPayload = null;
    console.log("AnonymousUserManager: Anonymous session cleared from storage and memory.");
  }

  // NEW: Method to handle logout scenario
  public async handleUserLogout(): Promise<void> {
    console.log("AnonymousUserManager: Handling user logout...");
    await this.clearCurrentAnonymousSession();
    // Immediately fetch a new anonymous token for the logged-out user
    await this.fetchAndStoreAnonymousToken();
    console.log("AnonymousUserManager: New anonymous session established after logout.");
  }

  // NEW: Method to force reinitialize (useful for testing or edge cases)
  public async forceReinitialize(): Promise<void> {
    this._isInitialized = false;
    this._initializingPromise = null;
    await this.ensureInitialized();
  }

  public async getAnonymousTokenHeader(): Promise<Record<string, string> | null> {
    const token = await this.getValidAnonymousToken();
    if (!token) return null;
    return { [ANONYMOUS_SESSION_TOKEN_HEADER]: token }; 
  }
}

export const anonymousUserManager = new AnonymousUserManager();
// // src/lib/anonymousUser.ts
// import { 
//     ANONYMOUS_API_PATHS, 
//     ANONYMOUS_SESSION_TOKEN_HEADER,
//     DecodedAnonymousSessionToken // Import the type from your types file
// } from '@/types/anonymous';
// import { APIError } from '@/types/api'; // Assuming you have this

// const ANONYMOUS_TOKEN_STORAGE_KEY = 'anonymousSessionToken';

// // CRITICAL: This must point to your AutomotiveServices.Api backend
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039'; 

// class AnonymousUserManager {
//   private storage = {
//     getItem: async (key: string): Promise<string | null> => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
//     setItem: async (key: string, value: string): Promise<void> => { if (typeof window !== 'undefined') localStorage.setItem(key, value); },
//     removeItem: async (key: string): Promise<void> => { if (typeof window !== 'undefined') localStorage.removeItem(key); },
//   };

//   private _currentAnonymousToken: string | null = null;
//   private _decodedTokenPayload: DecodedAnonymousSessionToken | null = null;
  
//   private _isInitialized: boolean = false;
//   private _initializingPromise: Promise<void> | null = null;

//   constructor() {
//     // Eagerly start the initialization process.
//     // Subsequent calls to public methods will await this promise if it's still pending.
//     this.ensureInitialized();
//   }

//   // Ensures initialize() is called only once and subsequent calls await its completion.
//   private async ensureInitialized(): Promise<void> {
//     if (this._isInitialized) return;
//     if (this._initializingPromise) return this._initializingPromise;

//     this._initializingPromise = this.initialize().finally(() => {
//         this._initializingPromise = null; // Clear promise once resolved/rejected
//     });
//     return this._initializingPromise;
//   }

//   private async initialize(): Promise<void> {
//     if (typeof window === 'undefined') {
//         this._isInitialized = true; // Mark initialized in non-browser envs
//         return;
//     }

//     console.log("AnonymousUserManager: Initializing...");
//     try {
//         const tokenFromStorage = await this.storage.getItem(ANONYMOUS_TOKEN_STORAGE_KEY);
//         if (tokenFromStorage) {
//             this.decodeAndStorePayload(tokenFromStorage); // This updates _decodedTokenPayload
//             if (this.isTokenExpired(this._decodedTokenPayload)) {
//                 console.warn("AnonymousUserManager: Token from storage is expired. Clearing and fetching new.");
//                 await this.clearCurrentAnonymousSession(); // Clears _currentAnonymousToken & _decodedTokenPayload
//                 await this.fetchAndStoreAnonymousToken(); // Fetches new and updates internal state
//             } else {
//                 this._currentAnonymousToken = tokenFromStorage; // Valid token from storage
//                 console.log("AnonymousUserManager: Loaded valid token from storage.");
//             }
//         } else {
//             console.log("AnonymousUserManager: No token in storage. Fetching new one.");
//             await this.fetchAndStoreAnonymousToken();
//         }
//     } catch (error) {
//         console.error("AnonymousUserManager: Error during initialization:", error);
//         // Ensure state is clean if initialization fails
//         this._currentAnonymousToken = null;
//         this._decodedTokenPayload = null;
//     }
//     this._isInitialized = true;
//     console.log("AnonymousUserManager: Initialization complete.");
//   }
  
//   private decodeAndStorePayload(token: string): void {
//     if (!token) {
//         this._decodedTokenPayload = null;
//         return;
//     }
//     try {
//       const payloadBase64Url = token.split('.')[1];
//       if (!payloadBase64Url) {
//         throw new Error("Invalid token format: Missing payload.");
//       }
//       const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
//       const payloadJson = decodeURIComponent(
//         atob(payloadBase64) // Browser's built-in Base64 decoder
//           .split('')
//           .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
//           .join('')
//       );
//       this._decodedTokenPayload = JSON.parse(payloadJson) as DecodedAnonymousSessionToken;
//     } catch (error) {
//       console.error("AnonymousUserManager: Error decoding token:", error);
//       this._decodedTokenPayload = null;
//       // If decoding fails, the token is likely corrupt or not a JWT.
//       // Consider clearing it from storage to force a refresh on next attempt.
//       // await this.storage.removeItem(ANONYMOUS_TOKEN_STORAGE_KEY); 
//       // this._currentAnonymousToken = null;
//     }
//   }
  
//   private isTokenExpired(payload: DecodedAnonymousSessionToken | null): boolean {
//     if (!payload || !payload.exp) {
//       return true; // No payload or no expiry claim means it's invalid/expired for our purposes
//     }
//     const nowInSeconds = Math.floor(Date.now() / 1000);
//     const bufferSeconds = 60; // e.g., 60 seconds buffer
//     return payload.exp < (nowInSeconds + bufferSeconds);
//   }

//   public async fetchAndStoreAnonymousToken(): Promise<string | null> {
//     if (typeof window === 'undefined') return null;

//     // Simple lock (could be more robust with a promise for concurrent calls if needed)
//     if ((this as any)._isFetchingTokenPromise) return (this as any)._isFetchingTokenPromise;

//     (this as any)._isFetchingTokenPromise = (async () => {
//         try {
//           console.log(`AnonymousUserManager: Fetching new anonymous session token from ${API_BASE_URL}${ANONYMOUS_API_PATHS.SESSIONS_CREATE}`);
//           const response = await fetch(`${API_BASE_URL}${ANONYMOUS_API_PATHS.SESSIONS_CREATE}`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//           });

//           if (!response.ok) {
//             const errorText = await response.text();
//             console.error(`AnonymousUserManager: Error fetching anonymous token: ${response.status} ${response.statusText}`, errorText);
//             throw new APIError(response.status, response.statusText, `Failed to fetch anonymous token: ${errorText}`, `${API_BASE_URL}${ANONYMOUS_API_PATHS.SESSIONS_CREATE}`);
//           }

//           const data = await response.json();
//           const token = data.anonymousSessionToken;

//           if (token && typeof token === 'string') {
//             await this.storage.setItem(ANONYMOUS_TOKEN_STORAGE_KEY, token);
//             this._currentAnonymousToken = token;
//             this.decodeAndStorePayload(token); // Update decoded payload
//             console.log("AnonymousUserManager: New anonymous session token fetched and stored.");
//             return token;
//           } else {
//             console.error("AnonymousUserManager: Invalid token format received:", data);
//             throw new Error("Invalid token format from API");
//           }
//         } catch (error) {
//           console.error("AnonymousUserManager: Exception during token fetch:", error);
//           // Clear potentially corrupt state on error
//           this._currentAnonymousToken = null;
//           this._decodedTokenPayload = null;
//           return null;
//         } finally {
//             (this as any)._isFetchingTokenPromise = null; // Release lock
//         }
//     })();
//     return (this as any)._isFetchingTokenPromise;
//   }

//   public async getValidAnonymousToken(): Promise<string | null> {
//     await this.ensureInitialized(); // Crucial: wait for initial load/fetch attempt

//     if (!this._currentAnonymousToken || this.isTokenExpired(this._decodedTokenPayload)) {
//       console.log("AnonymousUserManager: No valid token or token expired, attempting to fetch new one.");
//       return await this.fetchAndStoreAnonymousToken(); // This will update _currentAnonymousToken and _decodedTokenPayload
//     }
//     return this._currentAnonymousToken;
//   }
  
//   public async getAnonymousId(): Promise<string | null> {
//     await this.ensureInitialized();
//     // Ensure token is valid before extracting ID
//     const token = await this.getValidAnonymousToken(); 
//     if (token && this._decodedTokenPayload) { // _decodedTokenPayload should be fresh if token is
//         return this._decodedTokenPayload.anon_id;
//     }
//     return null;
//   }

//   // Method for the hook to get the already decoded payload
//   public getDecodedPayloadInternal(): DecodedAnonymousSessionToken | null {
//       // No need to await ensureInitialized here if methods calling it already do.
//       // However, ensuring the token isn't stale before returning payload is good.
//       if (this._currentAnonymousToken && !this.isTokenExpired(this._decodedTokenPayload)) {
//           return this._decodedTokenPayload;
//       }
//       return null; 
//   }

//   public async clearCurrentAnonymousSession(): Promise<void> {
//     if (typeof window === 'undefined') return;
//     await this.storage.removeItem(ANONYMOUS_TOKEN_STORAGE_KEY);
//     this._currentAnonymousToken = null;
//     this._decodedTokenPayload = null;
//     console.log("AnonymousUserManager: Anonymous session cleared from storage and memory.");
//   }

//   public async getAnonymousTokenHeader(): Promise<Record<string, string> | null> {
//     const token = await this.getValidAnonymousToken();
//     if (!token) return null;
//     return { [ANONYMOUS_SESSION_TOKEN_HEADER]: token }; 
//   }
// }

// export const anonymousUserManager = new AnonymousUserManager();