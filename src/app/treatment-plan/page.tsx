'use client';

import React from "react"; // Required for JSX
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProblemOverviewCard from '@/components/treatment-plan/ProblemOverviewCard';
import BiomarkersConcernCard from '@/components/treatment-plan/BiomarkersConcernCard';
import AssignedPractitionerInfoCard from '@/components/treatment-plan/AssignedPractitionerInfoCard';
import UpcomingConsultationsList from '@/components/treatment-plan/UpcomingConsultationsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MilestonesTracker from '@/components/treatment-plan/MilestonesTracker';
import TreatmentTimelineGanttChart from '@/components/treatment-plan/TreatmentTimelineGanttChart';
import { Button } from '@/components/ui/button';
// Assuming useToast is available or can be added if error notifications are desired
// import { useToast } from "@/hooks/use-toast"; 

export default function TreatmentPlanPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuthProtection("regular");
  const router = useRouter();
  const [treatmentPlan, setTreatmentPlan] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  // const { toast } = useToast(); // Uncomment if using toast

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.userType === 'regular') {
      async function fetchTreatmentPlan() {
        setPageLoading(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setError('Authentication token not found. Please log in.');
            // toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" }); // Optional
            setPageLoading(false);
            return;
          }

          const response = await fetch('/api/treatment-plan', {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch treatment plan');
          }

          const data = await response.json();
          setTreatmentPlan(data);
        } catch (error: any) {
          console.error('Error fetching treatment plan:', error);
          setError(error.message || 'Failed to load treatment plan');
          // toast({ title: "Error", description: error.message || 'Failed to load treatment plan', variant: "destructive" }); // Optional
        } finally {
          setPageLoading(false);
        }
      }
      fetchTreatmentPlan();
    } else if (!authLoading && (!isAuthenticated || user?.userType !== 'regular')) {
      setPageLoading(false); 
    }
  }, [authLoading, isAuthenticated, user]); // Removed router from deps as it's stable

  if (authLoading || pageLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated || user?.userType !== 'regular') {
    return <div className="flex justify-center items-center min-h-screen">Access Denied. Redirecting...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 p-4">
        <h1 className="text-2xl font-semibold text-destructive text-center">{error}</h1>
        <Button onClick={() => router.push('/login')}>Go to Login</Button>
      </div>
    );
  }
  
  if (!treatmentPlan) {
     return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <h1 className="text-2xl font-semibold text-primary">No treatment plan data available.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-primary tracking-tight">Your Personalized Treatment Plan</h1>
        <p className="text-lg text-muted-foreground mt-2">
          A holistic approach to guide you towards better health and well-being.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <ProblemOverviewCard 
            overview={treatmentPlan.problemOverview}
          />
          <MilestonesTracker milestones={treatmentPlan.milestones} />
        </div>
        <div className="space-y-8">
          <AssignedPractitionerInfoCard practitioner={treatmentPlan.assignedPractitioner} />
          <UpcomingConsultationsList consultations={treatmentPlan.upcomingConsultations} />
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Treatment Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <TreatmentTimelineGanttChart tasks={treatmentPlan.treatmentTimeline} />
        </CardContent>
      </Card>

      <BiomarkersConcernCard biomarkers={treatmentPlan.biomarkers} />
      
      {/* DailyScheduleView removed from here */}
      {/* 
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Daily Wellness Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyScheduleView activities={mockDailySchedule} />
        </CardContent>
      </Card>
      */}

    </div>
  );
}
