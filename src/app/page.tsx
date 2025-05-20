"use client"; // Required for hooks

import React from "react"; // Required for JSX
import { Metadata } from "next"; // Keep for metadata, though it might need adjustment for client components
import AuthContainer from "@/components/auth/AuthContainer";
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook

// Metadata might need to be handled differently if the page becomes fully client-rendered due to the hook.
// For now, let's assume it can coexist or will be adjusted in a follow-up if needed.
/*
export const metadata: Metadata = {
  title: "AyurView - Authentication",
  description: "Login or Signup to AyurView to access your personalized Ayurvedic healthcare dashboard",
};
*/

export default function HomePage() {
  const { isLoading, isAuthenticated } = useAuthProtection("auth");

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // If the hook determined the user is authenticated and has redirected,
  // this component might unmount before rendering AuthContainer.
  // If not loading and not yet redirected (e.g. user is not authenticated), show AuthContainer.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <main>
          <AuthContainer />
        </main>
      </div>
    );
  }
  
  // If authenticated, the hook should have redirected. 
  // Show a generic message or loader while redirect takes effect.
  return <div className="flex justify-center items-center min-h-screen">Redirecting to your dashboard...</div>;
}
