# Logistics Management Client (v1)

This repository contains the frontend application for the v1 Rally Logistics platform, built with Next.js and the App Router. This application functions as an OpenID Connect (OIDC) client and a user interface for the v1 Logistics API.

## 1. Application Overview

This application provides a user interface for discovering and interacting with logistics services and depots. It is designed to support a user flow that begins with geographic or categorical discovery and culminates in the selection of specific services.

The application architecture is built to manage distinct states for both guest (anonymous) and registered (authenticated) users, with functionality to merge guest data into a user's account upon sign-in.

### Key Features:

-   **Interactive Map Interface:** The UI is centered around a map powered by Leaflet.js. It features zoom-level-dependent data rendering, showing aggregated data at lower zoom levels and individual depot points at higher zoom levels.
-   **Hierarchical Content Discovery:** The application's routing and UI are structured to allow users to navigate from broad operational areas down to specific service categories and depot listings.
-   **Dual Session Management:**
    -   **Anonymous Sessions:** Guest users are issued a custom JWT (`X-Anonymous-Token`) to enable stateful features like a persistent shopping cart and saved location preferences.
    -   **Authenticated Sessions:** Registered users are authenticated via an OIDC Authorization Code Flow. The application uses the `next-auth` library to manage OIDC tokens and user sessions.
-   **Guest-to-User Data Merge:** Includes a mechanism to transfer an anonymous user's cart and preferences to their account when they sign in, preventing data loss during registration.
-   **Client-Side Data Caching:** Utilizes TanStack Query (React Query) to manage the fetching, caching, and synchronization of data from the Logistics API.

## 2. Architecture

The application is built using the Next.js App Router, which leverages Server Components for data fetching and Client Components for interactivity.

-   **State Management:**
    -   **React Context:** A multi-context approach is used for global state.
        -   `UserGeoLocationContext`: Manages the user's geographical location, sourced from the browser's Geolocation API, URL parameters, or saved preferences.
        -   `CartContext`: A session-aware context that directs cart operations to the appropriate backend API (`/anonymous/cart` or `/users/me/cart`) based on the user's authentication status.
        -   `GeoDataContext`: Provides static geographic boundary data to map components.
    -   **TanStack Query:** Manages all server state, including data from the Logistics API.
-   **Authentication:**
    -   **`next-auth`:** Handles the OIDC flow for registered users. Its configuration includes logic for token acquisition, session management, and background token refresh.
    -   **Custom Anonymous Session Manager:** A dedicated class (`lib/anonymousUser.ts`) manages the full lifecycle of the guest session token, including storage, validation, and renewal.
-   **API Integration:**
    -   A centralized API client (`lib/apiClient.ts`) handles all HTTP requests to the backend. It contains logic to dynamically attach the correct authentication token (`Bearer` or `X-Anonymous-Token`) to each request.

## 3. Environment Configuration

To run this application, create a `.env.local` file in the project root with the following variables:

```bash
# .env.local

# The base URL of the v1 Logistics API
NEXT_PUBLIC_API_BASE_URL="http://localhost:7039"

# The public-facing base URL of the v1 Duende IdentityServer
RALLY_IDP_ISSUER="https://localhost:7223"

# The Client ID for this application, as registered in the IdP
RALLY_IDP_CLIENT_ID="RALLY_MOTORS_GROUP"

# The Client Secret for this application, as registered in the IdP
RALLY_IDP_CLIENT_SECRET="RALLY_IDP_CLIENT_SECRET_FOR_NEXTJS_APP"

# A secret string used by NextAuth.js to sign its session cookies
NEXTAUTH_SECRET="your-nextauth-secret"

# The canonical URL of this Next.js application
NEXTAUTH_URL="http://localhost:3000"
```

## 4. Development Setup

1.  **Prerequisites:**
    -   Node.js (LTS version)
    -   The v1 Duende IdentityServer must be running.
    -   The v1 Logistics API must be running.

2.  **Installation:**
    -   Clone the repository.
    -   Install dependencies:
        ```bash
        npm install
        ```

3.  **Configuration:**
    -   Create and populate the `.env.local` file as described in the section above.

4.  **Execution:**
    -   Run the development server:
        ```bash
        npm run dev
        ```

The application will be available at `http://localhost:3000`.

git clone https://github.com/fady17/.netgeo.git
cd 
bun install
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_IDP_CLIENT_ID=...
NEXTAUTH_IDP_CLIENT_SECRET=...
NEXTAUTH_IDP_ISSUER=https://localhost:5005