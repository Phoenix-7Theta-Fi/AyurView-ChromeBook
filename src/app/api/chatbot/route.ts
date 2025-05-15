import { GoogleGenAI, FunctionCallingConfigMode, FunctionCall, type Chat } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getProductsForPurchaseDeclaration, handleProductRecommendations } from './functions/products';
import { getPractitionersForBookingDeclaration, handlePractitionerRecommendations } from './functions/practitioners';
import { getScheduleActivitiesDeclaration, handleScheduleActivities } from './functions/schedule';
import { getAnalyticsDataDeclaration, handleAnalyticsData } from './functions/analytics';
import type { Product, Practitioner, TreatmentPlanActivity } from '@/lib/types';
import { verifyJwtToken } from '@/lib/utils';

// Initialize Google GenAI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const DEFAULT_RESPONSE = "I understand your query. Let me help you with that.";

// Session storage
const chatSessions = new Map<string, ChatSessionManager>();

// Session cleanup (30 minutes timeout)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

interface ChatContext {
  lastInteraction: Date;
  functionCalls: FunctionCall[];
  products: Product[];
  practitioners: Practitioner[];
  analyticsData: { type: string; timeframe: string; }[];
  scheduleActivities: TreatmentPlanActivity[];
}

class ChatSessionManager {
  private chatInstance: Chat;
  private context: ChatContext;

  constructor() {
    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    this.chatInstance = genAI.chats.create({
      model: 'gemini-2.0-flash-001',
      config: {
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    });
    this.context = {
      lastInteraction: new Date(),
      functionCalls: [],
      products: [],
      practitioners: [],
      analyticsData: [],
      scheduleActivities: []
    };
  }

  private constructPrompt(question: string): string {
    return `You are AyurAid, an expert Ayurvedic health analyst and advisor with deep knowledge of holistic wellness.
You analyze health data and provide insightful, personalized observations based on Ayurvedic principles.

User's question: ${question}

Current Context:
- Previous Function Calls: ${this.context.functionCalls.length}
- Products Recommended: ${this.context.products.length}
- Practitioners Available: ${this.context.practitioners.length}
- Analytics Data Points: ${this.context.analyticsData.length}
- Schedule Activities: ${this.context.scheduleActivities.length}

Follow these guidelines:
For health analytics inquiries:
1. First, determine if the question asks about relationships between metrics. If it does:
   - Set includeRelated=true
   - Use the most relevant metric as primary
   - Related metrics will be automatically included

2. If analyzing a single metric, determine which one to analyze:
   - Sleep patterns/quality -> metric='sleep-wellness'
   - Diet/nutrition/food intake -> metric='diet-analytics'
   - Health markers/biomarkers -> metric='biomarkers'
   - Heart rate/cardio/fitness -> metric='cardio-performance'
   - Meditation/mindfulness -> metric='meditation-practices'
   - Exercise/workout progress -> metric='workout-overview'
   - Yoga practice/asanas -> metric='yoga-practices'

2. Consider the appropriate timeframe:
   - Use 'week' for recent patterns and immediate insights
   - Use 'month' for longer-term trends and established patterns
   - Default to 'month' if not specified

3. For comprehensive analysis:
   - Set includeRelated=true to analyze connections between different health aspects
   - Look for patterns across related metrics (e.g., sleep affecting meditation, diet impacting workouts)
   - Consider Ayurvedic principles like doshas and daily rhythms in your analysis

4. When providing insights:
   - First, give a high-level summary of what you observe in the data
   - Point out any notable patterns or trends, using specific examples
   - If includeRelated is true, discuss correlations with other health metrics
     (e.g., how sleep quality affects meditation performance)
   - Provide context from an Ayurvedic perspective, referencing concepts like:
     * Doshas (Vata, Pitta, Kapha) and their influence
     * Daily rhythms (dinacharya) and seasonal changes (ritucharya)
     * Balance between different aspects of health
   - Offer 2-3 specific, actionable recommendations based on Ayurvedic principles
   - Structure your response in a clear, conversational way
   - Reference the charts/data when discussing specific metrics
- If the user asks to buy, purchase, or shop for a product, call the getProductsForPurchase function with relevant keywords and count (1-3).
- For schedule-related queries:
  * "What's next" or "next activity" -> timing='next'
  * "Today's activities" or "schedule today" -> timing='today'
  * "Remaining activities today" -> timing='remaining'
  * "Upcoming activities" -> timing='upcoming'
  * "Pending activities" or "incomplete activities" or "what's left to do" -> timing='pending'
  * If a specific category is mentioned (wellness, fitness, etc.), include it as the category parameter
- Otherwise, your primary goal is to understand the user's question and provide direct Ayurvedic advice or information.
- Be conversational, empathetic, and helpful in your response.
- Ensure your advice is general and does not constitute medical diagnosis or treatment prescription.
- If the user asks for something beyond general advice (e.g., specific medical diagnosis, booking), gently guide them back to seeking advice or information within your scope, or suggest they consult a qualified practitioner or use the relevant sections of the application for such actions.`;
  }

  async processMessage(question: string, request: NextRequest) {
    this.context.lastInteraction = new Date();

    const result = await this.chatInstance.sendMessage({
      message: this.constructPrompt(question),
      config: {
        temperature: 0.7,
        maxOutputTokens: 800,
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['getProductsForPurchase', 'getPractitionersForBooking', 'getAnalyticsData', 'getScheduleActivities'],
          },
        },
        tools: [{ functionDeclarations: [getProductsForPurchaseDeclaration, getPractitionersForBookingDeclaration, getAnalyticsDataDeclaration, getScheduleActivitiesDeclaration] }],
      }
    });

    let text = result.text || DEFAULT_RESPONSE;

    // Process function calls and update context
    if (result.functionCalls && Array.isArray(result.functionCalls)) {
      this.context.functionCalls = this.context.functionCalls.concat(result.functionCalls);
      
      for (const fnCall of result.functionCalls) {
        if (fnCall.name === 'getProductsForPurchase' && fnCall.args) {
          const { products: selectedProducts, text: productText } = handleProductRecommendations({
            args: fnCall.args as { keywords?: string; count?: number }
          });
          this.context.products = selectedProducts;
          text = productText || text;
        }
        else if (fnCall.name === 'getPractitionersForBooking' && fnCall.args) {
          const { practitioners: selectedPractitioners, text: practitionerText } = handlePractitionerRecommendations({
            args: fnCall.args as { keywords?: string; count?: number }
          });
          this.context.practitioners = selectedPractitioners;
          text = practitionerText || text;
        }
        else if (fnCall.name === 'getScheduleActivities' && fnCall.args) {
          const { scheduleActivities: activities, text: scheduleText } = await handleScheduleActivities({
            args: fnCall.args as { timing: string; category?: string }
          }, request, JWT_SECRET);
          this.context.scheduleActivities = activities;
          text = scheduleText || text;
        }
        else if (fnCall.name === 'getAnalyticsData' && fnCall.args) {
          const { analyticsData: analytics, text: analyticsText } = await handleAnalyticsData({
            args: fnCall.args as { metric: string; timeframe: string; includeRelated?: boolean }
          }, request, GEMINI_API_KEY);
          this.context.analyticsData = analytics;
          text = analyticsText || text;
        }
      }
    }

    return {
      text,
      products: this.context.products,
      practitioners: this.context.practitioners,
      analyticsData: this.context.analyticsData,
      scheduleActivities: this.context.scheduleActivities
    };
  }

  getLastAccessTime(): number {
    return this.context.lastInteraction.getTime();
  }
}

// Cleanup inactive sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of chatSessions) {
    if (now - session.getLastAccessTime() > SESSION_TIMEOUT) {
      chatSessions.delete(token);
    }
  }
}, SESSION_TIMEOUT);

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const verified = await verifyJwtToken(token);
    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      );
    }

    // Get or create chat session
    let chatSession = chatSessions.get(token);
    if (!chatSession) {
      chatSession = new ChatSessionManager();
      chatSessions.set(token, chatSession);
    }

    // Process message and get response
    const result = await chatSession.processMessage(question, request);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in chatbot API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: errorMessage, text: `Sorry, I encountered an error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
