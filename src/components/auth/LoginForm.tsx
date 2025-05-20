"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to login");
      }

      // Store the token and user data in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on userType
      if (data.user?.userType === "practitioner") {
        router.push("/practitioner-dashboard");
      } else if (data.user?.userType === "regular") {
        router.push("/dashboard"); // Or "/treatment-plan" if that's preferred for regular users
      } else {
        // Fallback if userType is missing, though API should ensure it's present
        console.warn("UserType not found after login, defaulting to /dashboard");
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && (
        <div className="text-red-500 text-sm text-center">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Email address"
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
