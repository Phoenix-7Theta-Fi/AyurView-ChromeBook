"use client";

import React, { useEffect, useState } from "react";
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook
import { User } from "@/lib/types";
import PatientList from "@/components/dashboard/PatientList";

// Optional: If you have a shared PageContainer or Card component, import it here
// import PageContainer from '@/components/layout/PageContainer';
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const PractitionerDashboardPage: React.FC = () => {
  const { isLoading, isAuthenticated, user } = useAuthProtection("practitioner");
  const [patients, setPatients] = useState<User[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      if (user?.id) {
        setIsLoadingPatients(true);
        setError(null);
        try {
          const response = await fetch(`/api/practitioners/${user.id}/patients`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error: ${response.status}`);
          }
          const data: User[] = await response.json();
          setPatients(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoadingPatients(false);
        }
      } else if (user === null && !isLoading) {
        // User is loaded but not available (e.g. not logged in, or not a practitioner)
        // This case is mostly handled by useAuthProtection, but as a safeguard:
        setIsLoadingPatients(false);
        // setError("User not available to fetch patients."); // Optional: set an error
      }
    };

    // Only fetch patients if user is authenticated and available
    if (isAuthenticated && user) {
      fetchPatients();
    } else if (!isLoading) { // If not loading and not authenticated/user not available
        setIsLoadingPatients(false);
    }
  }, [user, isAuthenticated, isLoading]);

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

      <div className="mt-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Patients</h2>
        {isLoadingPatients && <p>Loading patients...</p>}
        {error && <p className="text-red-500">Error loading patients: {error}</p>}
        {!isLoadingPatients && !error && (
          <PatientList patients={patients} />
        )}
      </div>
    </div>
  );
};

export default PractitionerDashboardPage;
