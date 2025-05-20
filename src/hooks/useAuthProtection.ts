"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation"; // Import usePathname

export type PageType = "regular" | "practitioner" | "shared" | "auth";

interface User {
  id: string;
  name: string;
  email: string;
  userType: "regular" | "practitioner";
}

export function useAuthProtection(pageType: PageType) {
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userString = localStorage.getItem("user");
    let parsedUser: User | null = null;

    if (userString) {
      try {
        parsedUser = JSON.parse(userString);
        setUser(parsedUser); // Set user state
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem("user"); // Clear corrupted data
        // No router.replace here, let logic below handle it
      }
    }
    
    // If trying to access auth page (login/signup) but already logged in
    if (parsedUser && pageType === "auth") {
      if (parsedUser.userType === "practitioner") {
        router.replace("/practitioner-dashboard");
      } else {
        router.replace("/dashboard");
      }
      // No need to setIsLoading(false) here as the redirect will trigger a new render cycle
      return;
    }

    // If not an auth page and no user data, redirect to login
    if (pageType !== "auth" && !parsedUser) {
      router.replace(`/login?redirect=${pathname}`); // Add redirect query param
      // No need to setIsLoading(false) here
      return;
    }
    
    // If user data exists, set authenticated
    if (parsedUser) {
      setIsAuthenticated(true);
    }

    const userType = parsedUser?.userType;

    if (pageType !== "auth" && !userType) {
      console.warn("User type missing, redirecting to login.");
      localStorage.removeItem("user"); // Clear invalid user data
      router.replace(`/login?redirect=${pathname}`);
      return;
    }

    // Main redirection logic
    if (userType) {
      if (pageType === "practitioner" && userType !== "practitioner") {
        router.replace("/dashboard");
      } else if (pageType === "regular" && userType !== "regular") {
        router.replace("/practitioner-dashboard");
      } else if (pageType === "shared") {
        // For 'shared' pages, if a practitioner should ONLY see their dashboard:
        // if (userType === 'practitioner') router.replace('/practitioner-dashboard');
        // For now, 'shared' means accessible to both authenticated types without specific redirection
      }
    }
    
    // If we reach here, protection checks are done or not applicable
    setIsLoading(false);

  }, [router, pageType, pathname]); // Add pathname to dependencies

  return { isLoading, isAuthenticated, user }; // Return user object as well
}
