import type { LucideIcon } from "lucide-react";
import type { ObjectId } from "mongodb";

export interface Practitioner {
  _id?: ObjectId;
  id: string;
  name: string;
  specialization: string;
  bio: string;
  imageUrl?: string;
  gender: 'male' | 'female';
  rating: number;
  availability: string;
  location: string;
  dataAiHint?: string;
  availabilitySlots?: Array<{
    date: string;
    time: string;
    available: boolean;
  }>;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  dataAiHint?: string;
  category: string;
  stock: number;
}

export interface User {
  _id?: ObjectId;
  id: string;
  name: string;
  email: string;
  userType: 'regular' | 'practitioner';
  // Add other user-specific fields here if needed in the future
}

export interface CartItem extends Product {
  quantity: number;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

// Simplified ChatMessage type
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // The main textual content
  timestamp: Date;
  isLoading?: boolean; // For AI thinking state
}

export interface MedicationAdherenceData {
  date: Date;
  adherence: number; // 0 to 1, representing percentage
}

export interface Consultation {
  _id?: ObjectId;
  practitionerId: ObjectId;
  practitionerName: string;
  specialization: string;
  date: string;
  time: string;
  mode: 'online' | 'in-person';
  createdAt: Date;
  updatedAt: Date;
}

// Wrapper type for the AI response from getAyurvedicGuidance
export interface AyurvedicGuidanceAIFullResponse {
  text: string | null; // The primary textual answer
  error?: string; // If an error occurred
}

// Types for Treatment Plan Page
export interface Milestone {
  id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  dueDate?: string; // Optional due date
}

export interface ConcerningBiomarker {
  id: string;
  name: string;
  currentValue: string;
  targetValue: string;
  unit: string;
  lastChecked: string;
}

export interface UpcomingConsultation {
  id: string;
  practitionerName: string;
  specialization: string;
  date: string;
  time: string;
  mode: 'online' | 'in-person';
}

export interface TreatmentPlanActivity {
  id: string;
  time: string; // e.g., "07:00 AM"
  title: string; // e.g., "Morning Yoga"
  category: string; // e.g., "Wellness", "Fitness", "Nutrition", "Medical"
  description: string; // Short description for the card
  details: string; // Longer details for the modal, can be markdown/HTML
  icon: string; // Name of the Lucide icon (e.g., "Coffee", "Sprout")
  status: 'pending' | 'completed' | 'missed'; // For potential tracking
}

export interface WorkoutMetrics {
  userId: string;
  date: Date;
  metrics: {
    strength: {
      actual: number;
      target: number;
    };
    flexibility: {
      actual: number;
      target: number;
    };
    vo2Max: {
      actual: number;
      target: number;
    };
    endurance: {
      actual: number;
      target: number;
    };
    agility: {
      actual: number;
      target: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GanttTask {
  id: string;
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  category: 'Wellness' | 'Diet' | 'Medication' | 'Therapy' | 'Fitness' | 'Lifestyle';
  status?: 'pending' | 'in-progress' | 'completed';
}

export interface CardioPerformanceData {
  userId: string;
  date: Date;
  metrics: {
    duration: number; // in minutes
    distance: number; // in kilometers
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MeditationPractice {
  timestamp: Date;
  practiceType: 'mindfulness' | 'breath-work' | 'body-scan' | 'loving-kindness' | 'transcendental' | 'guided';
  duration: number; // in minutes
  completed: boolean;
}

export interface MeditationData {
  practicesByType: {
    [key: string]: {
      completed: number;
      attempted: number;
      totalDuration: number;
    };
  };
  totalSessions: number;
  completionRate: number;
  totalDuration: number;
}

export interface BiomarkerData {
  userId: string;
  biomarkerName: string;
  value: number;
  unit: string;
  date: Date;
  referenceRange: {
    min: number;
    max: number;
  };
  targetValue: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SleepWellnessData {
  userId: string;
  date: Date;
  sleepMetrics: {
    rem: number;
    deep: number;
    light: number;
    awake: number;
    totalDuration: number;
  };
  mentalWellness: {
    stressLevel: number;  // 1-10 scale
    moodScore: number;    // 1-10 scale
  };
  createdAt: Date;
  updatedAt: Date;
}
