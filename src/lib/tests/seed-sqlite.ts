import bcrypt from 'bcryptjs';
import { esmConnectToDb as connectToDb } from '../sqlite'; // Using correct ES6 named export and aliasing
import type { Database as SqliteDatabase, Statement } from 'sqlite3';
// import path from 'path'; 

let db: SqliteDatabase; // Type the db instance

// --- Data from MongoDB seed scripts ---

interface UserSeedData { name: string; email: string; userType: string; }
const usersData: UserSeedData[] = [
  { name: "John Doe", email: "john.doe@example.com", userType: "regular" },
  { name: "Jane Smith", email: "jane.smith@example.com", userType: "regular" },
  { name: "Dr. Ananya Sharma", email: "ananya.sharma@ayur.com", userType: "practitioner" },
  { name: "Yogi Rajendra Desai", email: "rajendra.desai@ayur.com", userType: "practitioner" },
  { name: "Ms. Priya Kulkarni", email: "priya.kulkarni@ayur.com", userType: "practitioner" },
  { name: "Dr. Vikram Singh", email: "vikram.singh@ayur.com", userType: "practitioner" },
  { name: "Dr. Meera Chavan", email: "meera.chavan@ayur.com", userType: "practitioner" },
  { name: "Acharya Advait Sharma", email: "advait.sharma@ayur.com", userType: "practitioner" },
  { name: "Amit Patel", email: "amit.patel@example.com", userType: "regular" },
  { name: "Sunita Rao", email: "sunita.rao@example.com", userType: "regular" }
];

interface PractitionerSeedData { original_id: string; name: string; gender: string; specialization: string; bio: string; rating: number; availability_text: string; location: string; image_url: string; data_ai_hint: string; }
const practitionersSeedData: PractitionerSeedData[] = [
  { original_id: '1', name: 'Dr. Ananya Sharma', gender: 'female', specialization: 'Ayurvedic General Practice', bio: 'Dr. Sharma is a renowned Ayurvedic practitioner...', rating: 4.8, availability_text: 'Mon, Wed, Fri (9 AM - 5 PM)', location: 'Online & New Delhi Clinic', image_url: 'https://picsum.photos/seed/dr_ananya_sharma/400/400', data_ai_hint: 'female ayurvedic doctor' },
  { original_id: '2', name: 'Yogi Rajendra Desai', gender: 'male', specialization: 'Yoga Therapy & Meditation', bio: 'Yogi Desai specializes in therapeutic yoga...', rating: 4.9, availability_text: 'Tue, Thu, Sat (7 AM - 11 AM)', location: 'Online', image_url: 'https://picsum.photos/seed/yogi_rajendra/400/400', data_ai_hint: 'male yoga instructor' },
  { original_id: '3', name: 'Ms. Priya Kulkarni', gender: 'female', specialization: 'Naturopathy & Herbal Medicine', bio: 'Priya focuses on natural healing methods...', rating: 4.7, availability_text: 'Flexible (By Appointment)', location: 'Pune Wellness Center', image_url: 'https://picsum.photos/seed/priya_kulkarni/400/400', data_ai_hint: 'female naturopath' },
  { original_id: '4', name: 'Dr. Vikram Singh', gender: 'male', specialization: 'Panchakarma Specialist', bio: 'With expertise in traditional Panchakarma therapies...', rating: 4.6, availability_text: 'Mon - Sat (10 AM - 6 PM)', location: 'Jaipur Ayurveda Hospital', image_url: 'https://picsum.photos/seed/dr_vikram_singh/400/400', data_ai_hint: 'male panchakarma doctor' },
  { original_id: '5', name: 'Dr. Meera Chavan', gender: 'female', specialization: 'Ayurvedic Nutrition & Dietetics', bio: 'Dr. Chavan provides personalized dietary consultations...', rating: 4.8, availability_text: 'Mon, Tue, Thu (2 PM - 7 PM)', location: 'Online', image_url: 'https://picsum.photos/seed/dr_meera_chavan/400/400', data_ai_hint: 'female nutrition doctor' },
  { original_id: '6', name: 'Acharya Advait Sharma', gender: 'male', specialization: 'Vedic Astrology & Wellness', bio: 'Acharya Advait combines Vedic astrology...', rating: 4.5, availability_text: 'Wed, Fri (11 AM - 4 PM)', location: 'Online & Rishikesh Ashram', image_url: 'https://picsum.photos/seed/acharya_advait/400/400', data_ai_hint: 'male vedic astrologer' }
];

function generatePractitionerTimeSlots(availabilityText: string): Array<{ date: string; time: string; is_available: number }> {
  const slots: Array<{ date: string; time: string; is_available: number }> = [];
  const timeSlotsPattern = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'];
  const availabilityDays = availabilityText.split('(')[0].trim().toLowerCase().split(',').map((day: string) => day.trim().substring(0, 3));
  for (let i = 0; i < 30; i++) {
    const date = new Date(); date.setDate(date.getDate() + i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase().substring(0, 3);
    if (!availabilityDays.some(availDay => dayName.includes(availDay))) continue;
    timeSlotsPattern.forEach(time => slots.push({ date: date.toISOString().split('T')[0], time, is_available: Math.random() > 0.2 ? 1 : 0 }));
  } return slots;
}

const productsSeedData = [
    { name: 'Ashwagandha Capsules', description: 'Powerful adaptogen...', price: 15.99, image_url: 'https://picsum.photos/seed/ashwagandha_capsules/400/400', data_ai_hint: 'herbal supplement bottle', category: 'Supplements', stock: 50 },
    { name: 'Triphala Churna', description: 'Traditional Ayurvedic blend...', price: 12.50, image_url: 'https://picsum.photos/seed/triphala_powder/400/400', data_ai_hint: 'ayurvedic powder', category: 'Herbal Powders', stock: 30 },
];

const conditionsData = [
  { title: "Chronic Stress & Digestive Imbalance (Vata Aggravation)", description: "Patient reports persistent stress...", summary: "Holistic plan focusing on Vata pacification...", goals: ["Reduce stress by 50%", "Improve sleep"], biomarkers: [{ name: "Cortisol (Morning)", currentValue: "25", targetValue: "<15", unit: "µg/dL" }] },
  { title: "Metabolic Imbalance & Weight Management (Kapha Predominant)", description: "Patient presents with slow metabolism...", summary: "Comprehensive plan to stimulate metabolism...", goals: ["Achieve weight loss of 5-6 kg"], biomarkers: [{ name: "BMI", currentValue: "28.5", targetValue: "23-25", unit: "kg/m²" }] },
];

function generateTreatmentTimeline(conditionTitle: string): any[] {
  const sD = new Date(); const tl: any[] = []; let cId = 1;
  tl.push({ oId: `tt${cId++}`, name: 'Initial Consultation', sD: sD.toISOString().split('T')[0], eD: new Date(sD.getTime() + 2*24*60*60*1000).toISOString().split('T')[0], cat: 'Wellness', stat: 'completed' });
  const dietS = new Date(sD.getTime() + 3*24*60*60*1000);
  tl.push({ oId: `tt${cId++}`, name: `${conditionTitle.slice(0,10)} Diet Plan`, sD: dietS.toISOString().split('T')[0], eD: new Date(dietS.getTime() + 42*24*60*60*1000).toISOString().split('T')[0], cat: 'Diet', stat: 'in-progress' });
  return tl;
}
function generateTreatmentMilestones(conditionTitle: string): any[] {
  const sD = new Date(); const m: any[] = []; let cId = 1;
  m.push({ oId: `m${cId++}`, title: "Initial Assessment", stat: 'completed', due: sD.toISOString().split('T')[0] });
  m.push({ oId: `m${cId++}`, title: `${conditionTitle.slice(0,10)} Protocol Impl.`, stat: 'in-progress', due: new Date(sD.getTime() + 14*24*60*60*1000).toISOString().split('T')[0] });
  return m;
}

const biomarkerConfigs = [ { name: 'Resting Heart Rate', unit: 'bpm', optimalRange: [60, 80], targetValue: 70 }, { name: 'Systolic BP', unit: 'mmHg', optimalRange: [110, 120], targetValue: 115 }, /* ... more configs */ ];
const activityTemplates = { vata: { morning: [{ title: "Vata Morning", category:"Wellness", duration:20, icon:"Heart", description:"Desc", details:"Det" }], meals: [{ title:"Vata Meal", category:"Nutrition", duration:30, icon:"Apple", description:"Desc", details:"Det" }] }, pitta: { morning: [{ title: "Pitta Morning", category:"Wellness", duration:20, icon:"Moon", description:"Desc", details:"Det" }], meals: [{ title:"Pitta Meal", category:"Nutrition", duration:30, icon:"Apple", description:"Desc", details:"Det" }] }, kapha: { morning: [{ title: "Kapha Morning", category:"Wellness", duration:20, icon:"Sun", description:"Desc", details:"Det" }], meals: [{ title:"Kapha Meal", category:"Nutrition", duration:30, icon:"Apple", description:"Desc", details:"Det" }] } };
const healthActivities = { stress: [{ title: "Stress Relief", category:"Wellness", duration:15, icon:"Wind", description:"Desc", details:"Det" }], digestion: [{ title: "Digestive Aid", category:"Wellness", duration:15, icon:"Cup", description:"Desc", details:"Det" }], sleep: [{ title: "Sleep Prep", category:"Lifestyle", duration:30, icon:"Moon", description:"Desc", details:"Det" }] };
function generateScheduleTimeStringLocal(hour, minute) { const p = hour >= 12 ? 'PM':'AM'; const h = hour > 12 ? hour - 12 : hour; return `${String(h).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${p}`; }

const MEDITATION_PRACTICE_TYPES = [ 'mindfulness', 'breath-work', 'body-scan', 'loving-kindness', 'transcendental', 'guided' ];
const MEDITATION_PRACTICE_DURATIONS = [ 5, 10, 15, 20, 30, 45 ];
const YOGA_TYPES_DATA = [ { name: 'Hatha Yoga', practices: ['Posture Alignment', 'Breath Control'], subPractices: { 'Posture Alignment': { 'Balance Practice': ['Standing Poses', 'Core Strength'], 'Spine Health': ['Back Bends', 'Twists'] }, 'Breath Control': { 'Pranayama': ['Meditation', 'Energy Work'] } } }, /* more yoga types */ ];
const WORKOUT_BASE_METRICS = { strength: { base: 70, variance: 10, target: 85 }, flexibility: { base: 65, variance: 8, target: 75 }, vo2Max: { base: 50, variance: 12, target: 60 }, endurance: { base: 75, variance: 15, target: 90 }, agility: { base: 60, variance: 10, target: 80 } };


// --- Utility Functions ---
// The local connectDb function is removed. We'll use the imported one.

// closeDb can remain to explicitly close the connection after seeding.
// However, the application's connectToDb might manage a singleton.
// For a script, it's usually fine to close what it opened/received.
function closeDb(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (db && typeof db.close === 'function') {
      db.close((err: Error | null) => {
        if (err) {
          console.error("Error closing database from seed script:", err.message);
          reject(err);
        } else {
          console.log("Database connection closed from seed script.");
          resolve();
        }
      });
    } else {
      console.log("No active DB connection from seed script to close or DB object is not as expected.");
      resolve();
    }
  });
}

async function tableIsEmpty(tableName: string): Promise<boolean> { 
  return new Promise<boolean>((resolve, reject) => { 
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err: Error | null, row: { count: number }) => { 
      if (err) { 
        console.error(`Error checking count for ${tableName}:`, err.message); 
        reject(err); 
      } else { 
        resolve(row.count === 0); 
      } 
    }); 
  }); 
}

async function getAllUserIds(): Promise<number[]> { 
  return new Promise<number[]>((resolve, reject) => { 
    db.all("SELECT id FROM users WHERE userType = 'regular'", (err: Error | null, rows: {id: number}[]) => { 
      if (err) {
        reject(err); 
      } else {
        resolve((rows || []).map(r => r.id)); 
      }
    }); 
  }); 
}


// --- Seeding Functions ---
// Removing the duplicate function declarations as they were causing TS errors.
// The actual implementations with types are below.


// --- Main Execution ---
async function main() {
  try {
    // Use the imported connectToDb which handles schema creation and returns the db instance
    db = await connectToDb(); 
    console.log("Database connection established and schema should be initialized.");

    // PRAGMA foreign_keys = ON; is handled by the connectToDb -> initializeDbSchema in sqlite.ts
    
    await new Promise<void>((resolve, reject) => db.run('BEGIN TRANSACTION', (err: Error | null) => err ? reject(err) : resolve()));
    console.log("BEGINNING SEED TRANSACTION");

    await seedUsers();
    await seedPractitioners();
    await seedProducts();
    await seedConsultationsAndAssignments();
    await seedTreatmentPlans();
    await seedBiomarkersUserLog();
    await seedCardioPerformanceLog();
    await seedDailyScheduleActivities();
    await seedDietAnalyticsLog();
    await seedMedicationAdherenceLog();
    await seedMeditationPracticesLog();
    await seedSleepWellnessLog();
    await seedWorkoutMetricsLog();
    await seedYogaPracticesLog();

    await new Promise<void>((resolve, reject) => db.run('COMMIT', (err: Error | null) => err ? reject(err) : resolve()));
    console.log("SEED TRANSACTION COMMITTED");

  } catch (error: any) {
    console.error('Seeding failed:', error);
    if(db) {
        await new Promise<void>((resolve, reject) => db.run('ROLLBACK', (errRoll: Error | null) => {
            if(errRoll) console.error("ROLLBACK FAILED:", errRoll); else console.log("SEED TRANSACTION ROLLED BACK");
            resolve();
        }));
    }
  } finally {
    await closeDb();
  }
}

main();
