'use client';
import { useAnonymousSession } from '@/hooks/useAnonymousSession';
import { useEffect } from 'react';

function MyTestComponent() {
  const { anonymousToken, anonId, decodedPayload, isLoading, refreshAnonymousSession, clearAnonymousSession } = useAnonymousSession();

  useEffect(() => {
    if (!isLoading) {
      console.log("Hook - Anonymous Token:", anonymousToken);
      console.log("Hook - Anon ID (from payload):", anonId);
      console.log("Hook - Decoded Payload:", decodedPayload);
    }
  }, [anonymousToken, anonId, decodedPayload, isLoading]);

  if (isLoading) {
    return <p>Loading anonymous session...</p>;
  }

  return (
    <div>
      <p>Anonymous Token: {anonymousToken || "Not available"}</p>
      <p>Anonymous ID (from token): {anonId || "Not available"}</p>
      <button onClick={refreshAnonymousSession} className="m-2 p-2 border">Refresh Token</button>
      <button onClick={clearAnonymousSession} className="m-2 p-2 border">Clear Token</button>
    </div>
  );
}
export default MyTestComponent;