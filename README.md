# Location Discovery Frontend (Next.js + NextAuth + Leaflet)

This is the frontend for a location-based platform that allows users to discover nearby services using maps.  
It uses **Next.js** (with Bun), **Leaflet** for interactive maps, and **NextAuth.js** for authentication via IdentityServer.

🔗 **Backend API**: [github.com/fady17/location-platform-api]( https://github.com/fady17/.netgeo.git )
	
	•	IdentityServer: https://github.com/fady17/rally.git

---

## 🧭 Features

- 📍 Leaflet-based map UI for location discovery
- 🔐 Login via OpenID Connect (OIDC) with Duende IdentityServer
- 🔑 Token-based API requests to the backend
- 🍞 Bun for fast local dev

---

## 🛠 Stack

| Tech           | Role                            |
|----------------|----------------------------------|
| Next.js        | UI framework                     |
| Leaflet        | Map rendering                    |
| NextAuth.js    | Authentication                   |
| IdentityServer | OIDC provider                    |
| Bun            | Runtime & package manager        |

---

## 🚀 Getting Started

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/fady17/.netgeo.git
cd 
bun install
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_IDP_CLIENT_ID=...
NEXTAUTH_IDP_CLIENT_SECRET=...
NEXTAUTH_IDP_ISSUER=https://localhost:5005