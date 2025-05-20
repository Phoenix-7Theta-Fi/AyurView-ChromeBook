'use client';

import React from "react"; // Required for JSX
import { useState } from 'react';
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook
import ChatInterface from '@/components/chatbot/ChatInterface';
import HealthAssessmentInterface from '@/components/chatbot/HealthAssessmentInterface';
import HealthAssessmentToggle from '@/components/chatbot/HealthAssessmentToggle';

export default function ChatbotPage() {
  const { isLoading, isAuthenticated, user } = useAuthProtection("regular");
  const [isHealthMode, setIsHealthMode] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated || user?.userType !== 'regular') {
    // This should ideally not be reached if the hook redirects properly
    return <div className="flex justify-center items-center min-h-screen">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[calc(100vh-120px)]">
      <div className="bg-background border-b">
        <div className="container mx-auto px-4">
          <HealthAssessmentToggle
            isActive={isHealthMode}
            onToggle={setIsHealthMode}
          />
        </div>
      </div>
      <div className="flex-1 container mx-auto px-4 py-4">
        {isHealthMode ? <HealthAssessmentInterface /> : <ChatInterface />}
      </div>
    </div>
  );
}
