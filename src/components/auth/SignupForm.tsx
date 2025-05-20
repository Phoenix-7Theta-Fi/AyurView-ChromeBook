"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const userType = formData.get("userType") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!userType) {
      setError("Please select a user type");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, userType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      // Store the token and user data in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on userType
      if (data.user?.userType === "practitioner") {
        router.push("/practitioner-dashboard");
      } else if (data.user?.userType === "regular") {
        router.push("/dashboard"); // Or "/treatment-plan" if that's preferred for new regular users
      } else {
        // Fallback if userType is missing, though API should ensure it's present
        console.warn("UserType not found after signup, defaulting to /dashboard");
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
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Full name"
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
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
            autoComplete="new-password"
            required
            placeholder="Password"
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Confirm password"
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">User Type</label>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <input
              id="userTypeRegular"
              name="userType"
              type="radio"
              value="regular"
              required
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
            />
            <label htmlFor="userTypeRegular" className="ml-2 block text-sm text-gray-900">
              Regular
            </label>
          </div>
          <div className="flex items-center">
            <input
              id="userTypePractitioner"
              name="userType"
              type="radio"
              value="practitioner"
              required
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
            />
            <label htmlFor="userTypePractitioner" className="ml-2 block text-sm text-gray-900">
              Practitioner
            </label>
          </div>
        </div>
      </div>

      <div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </div>
    </form>
  );
}
