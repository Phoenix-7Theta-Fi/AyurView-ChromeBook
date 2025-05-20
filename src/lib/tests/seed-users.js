const { connectToDb, createUser } = require('./mongodb-seed');

const users = [
  { name: "John", email: "john@ayur.com", userType: "practitioner" },
  { name: "Sarah", email: "sarah@ayur.com", userType: "regular" },
  { name: "Michael", email: "michael@ayur.com", userType: "regular" },
  { name: "Emma", email: "emma@ayur.com", userType: "regular" },
  { name: "David", email: "david@ayur.com", userType: "regular" },
  { name: "Lisa", email: "lisa@ayur.com", userType: "regular" },
  { name: "James", email: "james@ayur.com", userType: "regular" },
  { name: "Anna", email: "anna@ayur.com", userType: "regular" },
  { name: "Robert", email: "robert@ayur.com", userType: "regular" },
  { name: "Maria", email: "maria@ayur.com", userType: "regular" }
];

async function seedUsers() {
  try {
    console.log('Connecting to database...');
    await connectToDb();
    
    console.log('Starting user seeding...');
    const password = 'harsha';
    
    for (const user of users) {
      try {
        await createUser(user.name, user.email, password, user.userType);
        console.log(`Created user: ${user.email} as ${user.userType}`);
      } catch (error) {
        if (error instanceof Error && error.message === 'User already exists') {
          console.log(`Skipping ${user.email} - already exists`);
        } else {
          console.error(`Error creating user ${user.email}:`, error);
        }
      }
    }
    
    console.log('User seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed users:', error);
    process.exit(1);
  }
}

seedUsers();
