
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react'; // Added for state and effect
import { Bot, LayoutDashboard, Leaf, Users, ShoppingCart as ShoppingCartLucideIcon, ClipboardList, CalendarCheck, LogOut, LogIn, UserPlus } from 'lucide-react'; // Added LogIn, UserPlus
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ShoppingCartIcon from '@/components/shop/ShoppingCartIcon';
import ShoppingCart from '@/components/shop/ShoppingCart';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  userType: "regular" | "practitioner";
}

const regularNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/treatment-plan', label: 'Treatment Plan', icon: ClipboardList },
  { href: '/schedule', label: 'Schedule', icon: CalendarCheck },
  { href: '/chatbot', label: 'Chatbot', icon: Bot },
  { href: '/practitioners', label: 'Practitioners', icon: Users },
  { href: '/shop', label: 'Shop', icon: ShoppingCartLucideIcon },
];

const practitionerNavItems = [
  { href: '/practitioner-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // Add other practitioner specific links here, e.g., Profile, Patients
];

const unauthenticatedNavItems = [
  { href: '/', label: 'Login', icon: LogIn }, // Assuming '/' is the login/signup page (AuthContainer)
  // { href: '/signup', label: 'Sign Up', icon: UserPlus }, // If signup is a separate page
];


export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false); // To handle localStorage only on client

  useEffect(() => {
    setIsClient(true); // Component has mounted, localStorage can be accessed
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        setUser(JSON.parse(userString));
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        localStorage.removeItem("user"); // Clear corrupted data
        setUser(null);
      }
    }
  }, [pathname]); // Re-check on pathname change if user might have logged in/out

  const handleSignOut = async () => {
    try {
      // Call API endpoint if it handles session invalidation server-side
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Even if API call fails, clear client-side indicators of session
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null); // Update state
      
      if (response.ok) {
        router.push('/'); // Redirect to login page
        // router.refresh(); // Not always needed, push usually triggers re-render
      } else {
        console.error("Sign out API call failed, but client session cleared.");
        router.push('/'); // Still redirect
      }
    } catch (error) {
      console.error('Error signing out:', error);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      router.push('/');
    }
  };
  
  let currentNavItems = unauthenticatedNavItems;
  let logoHref = "/";

  if (isClient && user) {
    if (user.userType === 'practitioner') {
      currentNavItems = practitionerNavItems;
      logoHref = "/practitioner-dashboard";
    } else if (user.userType === 'regular') {
      currentNavItems = regularNavItems;
      logoHref = "/dashboard";
    }
  } else if (!isClient) {
    // Render nothing or a placeholder for nav items until client is determined
    currentNavItems = []; 
  }


  return (
    <>
      <header className="bg-card shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={logoHref} className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
            <Leaf size={28} />
            <h1 className="text-2xl font-bold">AyurAid</h1>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {isClient && currentNavItems.map((item) => (
              <Button
                key={item.href}
                variant={pathname === item.href ? 'default' : 'ghost'}
                asChild
                className={cn(
                  "transition-all duration-200 ease-in-out",
                  pathname === item.href 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                <Link href={item.href} className="flex items-center gap-2 px-2 py-2 sm:px-3 rounded-md">
                  <item.icon size={20} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </Button>
            ))}
            {isClient && user && user.userType === 'regular' && <ShoppingCartIcon />}
            {isClient && user && (
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="flex items-center gap-2 px-2 py-2 sm:px-3 rounded-md text-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
            {isClient && !user && unauthenticatedNavItems.length === 0 && ( // Fallback if unauth items are not defined above for some reason
                <Button variant="ghost" asChild>
                  <Link href="/" className="flex items-center gap-2 px-2 py-2 sm:px-3 rounded-md">
                    <LogIn size={20} />
                    <span className="hidden sm:inline">Login</span>
                  </Link>
                </Button>
            )}
          </nav>
        </div>
      </header>
      {isClient && user && user.userType === 'regular' && <ShoppingCart />} 
    </>
  );
}
