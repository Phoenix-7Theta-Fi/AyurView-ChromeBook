"use client";

import React from "react";
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook

// Optional: If you have a shared PageContainer or Card component, import it here
// import PageContainer from '@/components/layout/PageContainer';
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const PractitionerDashboardPage: React.FC = () => {
  const { isLoading, isAuthenticated, user } = useAuthProtection("practitioner");

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    // This should ideally not be reached if the hook redirects properly
    return <div className="flex justify-center items-center min-h-screen">Redirecting to login...</div>;
  }
  
  // Ensure user is not null and is a practitioner before rendering practitioner content
  if (user?.userType !== 'practitioner') {
    // This case should be handled by the hook's redirect, but as a fallback:
    return <div className="flex justify-center items-center min-h-screen">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 
        Example usage with a Card component (if available and desired):
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-gray-800">
              Practitioner Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg text-gray-600">
              Welcome, Practitioner!
            </p>
          </CardContent>
        </Card>
      */}

      {/* Basic implementation without a Card component */}
      <div className="bg-white shadow-md rounded-lg p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Practitioner Dashboard
        </h1>
        <p className="text-lg text-gray-600 text-center">
          Welcome, Practitioner!
        </p>
        {/* Add more practitioner-specific content here in the future */}
      </div>
    </div>
  );
};

export default PractitionerDashboardPage;
