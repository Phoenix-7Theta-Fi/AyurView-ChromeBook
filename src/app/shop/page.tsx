'use client';

import { useState, useEffect } from 'react';
import { useAuthProtection } from "@/hooks/useAuthProtection"; // Import the hook
import ProductCard from '@/components/shop/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

export default function ShopPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuthProtection("regular");
  const [products, setProducts] = useState<Product[]>([]);
  const [pageLoading, setPageLoading] = useState(true); // Renamed to avoid conflict
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.userType === 'regular') {
      const fetchProducts = async () => {
        setPageLoading(true); // Start page loading when auth is complete
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            // This case should be handled by useAuthProtection, but as a fallback:
            setError('Authentication token not found. Please log in again.');
            toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
            setPageLoading(false);
            return;
          }

          const response = await fetch('/api/products', {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch products');
          }

          const data = await response.json();
          setProducts(data);
        } catch (error: any) {
          console.error('Error fetching products:', error);
          setError(error.message);
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
          setPageLoading(false);
        }
      };
      fetchProducts();
    } else if (!authLoading && (!isAuthenticated || user?.userType !== 'regular')) {
      // If auth is done, but user is not authenticated or not regular, stop page loading.
      // The hook should have already initiated a redirect.
      setPageLoading(false);
    }
  }, [authLoading, isAuthenticated, user, toast]);

  if (authLoading || pageLoading) { // Check both loading states
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // If after auth check, user is not authenticated or not regular, show access denied or redirect.
  // The hook should handle redirection, so this is a fallback.
  if (!isAuthenticated || user?.userType !== 'regular') {
    return <div className="flex justify-center items-center min-h-screen">Access Denied. Redirecting...</div>;
  }
  
  // Error state for product fetching
  if (error) {
    return (
      <div className="text-center space-y-4 mt-10">
        <h1 className="text-3xl font-bold text-destructive tracking-tight sm:text-4xl">
          Error Loading Products
        </h1>
        <p className="text-lg text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight sm:text-4xl">
          AyurAid Wellness Shop
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover our curated selection of authentic Ayurvedic products for your holistic well-being.
        </p>
      </div>
      
      {/* Placeholder for Filters and Search - Future Enhancement */}
      {/* 
      <div className="py-4 px-2 bg-card rounded-lg shadow-sm border border-border">
        <p className="text-center text-muted-foreground">Filters and Search Functionality (Coming Soon)</p>
      </div> 
      */}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 xl:gap-8">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && !pageLoading && !error && (
        <div className="text-center">
          <p className="text-lg text-muted-foreground">No products available at the moment.</p>
        </div>
      )}

      <div className="text-center mt-12">
        <Badge variant="secondary" className="text-sm p-2">
          More Ayurvedic treasures coming soon!
        </Badge>
      </div>
    </div>
  );
}
