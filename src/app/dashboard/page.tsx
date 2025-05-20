
"use client"; // Required for hooks like useAuthProtection

import React from "react"; // Required for JSX
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook
import MedicationAdherenceCalendar from '@/components/dashboard/MedicationAdherenceCalendar';
import CalendarLegend from '@/components/dashboard/CalendarLegend';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import DietAnalyticsChart from '@/components/dashboard/charts/DietAnalyticsChart';
import WorkoutRadialChart from '@/components/dashboard/charts/WorkoutRadialChart';
import CardioChart from '@/components/dashboard/charts/CardioChart';
import YogaSunburstChart from '@/components/dashboard/charts/YogaSunburstChart';
import SleepMetricsChart from '@/components/dashboard/charts/SleepMetricsChart';
import MeditationDonutChart from '@/components/dashboard/charts/MeditationDonutChart';
import BiomarkersChart from '@/components/dashboard/charts/BiomarkersChart';

export default function DashboardPage() {
  const { isLoading, isAuthenticated, user } = useAuthProtection("regular");

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    // This should ideally not be reached if the hook redirects properly
    return <div className="flex justify-center items-center min-h-screen">Redirecting to login...</div>;
  }

  // Optional: Additional check if user is indeed regular, though hook should handle redirect
  if (user?.userType !== 'regular') {
    return <div className="flex justify-center items-center min-h-screen">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Medication Adherence</CardTitle>
            <CardDescription>
              Daily medication adherence. Colors indicate medication taken.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 p-2 sm:p-4">
            <MedicationAdherenceCalendar />
            <CalendarLegend />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Key Biomarkers</CardTitle>
            <CardDescription>Current status of key health indicators. Scroll to view all.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 max-h-[600px] lg:max-h-[calc(600px+100px)] overflow-y-auto"> {/* Adjusted max-h for lg screens to better align with calendar height */}
            <BiomarkersChart />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Diet Analytics</CardTitle>
          <CardDescription>Daily macronutrient and micronutrient intake over the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <DietAnalyticsChart />
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Workout Overview</CardTitle>
            <CardDescription>Key fitness metrics.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <WorkoutRadialChart />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Cardio Performance</CardTitle>
            <CardDescription>Cardio workout trends over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <CardioChart />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Yoga Practice Breakdown</CardTitle>
            <CardDescription>Distribution of yoga types and focus areas.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <YogaSunburstChart />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Meditation Practices</CardTitle>
            <CardDescription>Distribution of time spent in different meditation types.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <MeditationDonutChart />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Sleep & Mental Wellness</CardTitle>
          <CardDescription>Sleep stages and mental health metrics over the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <SleepMetricsChart />
        </CardContent>
      </Card>
      
    </div>
  );
}

