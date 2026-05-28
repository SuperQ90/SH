import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-green-950/20 to-slate-950 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <CheckCircle className="w-24 h-24 text-green-500 mx-auto animate-pulse" />
        </div>
        
        <h1 className="text-4xl font-bold mb-4 text-white">Payment Successful!</h1>
        <p className="text-lg text-gray-300 mb-8">
          Thank you for upgrading to premium. Your subscription is now active and you can enjoy all premium features.
        </p>
        
        <div className="space-y-4">
          <Button 
            onClick={() => navigate('/')}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Go to Home
          </Button>
          <Button 
            onClick={() => navigate('/my-profile')}
            variant="outline"
            className="w-full"
          >
            View Profile
          </Button>
        </div>
        
        <p className="text-sm text-gray-400 mt-8">
          You will be automatically redirected to the home page in a few seconds...
        </p>
      </div>
    </div>
  );
}