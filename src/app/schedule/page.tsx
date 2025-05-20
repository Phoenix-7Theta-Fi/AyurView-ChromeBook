'use client';

import React from "react"; // Required for JSX
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook
import DailyScheduleView from '@/components/treatment-plan/DailyScheduleView';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDailySchedule } from '@/hooks/use-daily-schedule';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function SchedulePage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuthProtection("regular");
  const { data: activities, isLoading: scheduleLoading, error } = useDailySchedule();

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading authentication...</div>;
  }

  if (!isAuthenticated || user?.userType !== 'regular') {
    // This should ideally not be reached if the hook redirects properly
    // Or if reached, it means the hook has decided this content shouldn't be shown
    // and a redirect is in progress or has completed.
    return <div className="flex justify-center items-center min-h-screen">Access Denied. Redirecting...</div>;
  }

  // If authenticated and userType is correct, proceed to render page content
  return (
    <div className="space-y-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-primary tracking-tight">Your Daily Wellness Schedule</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Follow your personalized daily plan for optimal health and well-being.
        </p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Today's Activities</CardTitle>
          <CardDescription>Click on an activity to see more details.</CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleLoading ? ( // Use scheduleLoading here
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          ) : (
            <DailyScheduleView activities={activities} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
