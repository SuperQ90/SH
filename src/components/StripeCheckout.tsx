// src/components/StripeCheckout.tsx
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const PLANS = [
  {
    id: "creator-monthly",
    name: "Creator Monthly",
    desc: "For regular uploaders and listeners.",
    priceLabel: "$4.99 / month",
    stripePriceId: "price_1Ryom7PJqUWAU2UQBomcID8Y",
  },
  {
    id: "creator-yearly",
    name: "Creator Yearly",
    desc: "Best value. Pay once, chill for 12 months.",
    priceLabel: "$35 / year",
    stripePriceId: "price_1RyoplPJqUWAU2UQMDe9JlEi",
  },
];

export default function StripeCheckout() {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCheckout = async (plan: (typeof PLANS)[number]) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Log in first so we can link the payment to your account.",
        variant: "destructive",
      });
      return;
    }

    if (!plan.stripePriceId) {
      toast({
        title: "Plan misconfigured",
        description: "This plan does not have a Stripe price attached.",
        variant: "destructive",
      });
      return;
    }

    const origin = window.location.origin;

    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          price_id: plan.stripePriceId,
          user_id: user.id,
          user_email: user.email, // <- force email
          plan_code: plan.id,
          success_url: `${origin}/payment-success`,
          cancel_url: `${origin}/pricing`,
        },
      });

      if (error || !data?.url) {
        console.error("stripe-checkout failed:", error || data);
        toast({
          title: "Checkout failed",
          description: error?.message || data?.error || "Could not start Stripe checkout.",
          variant: "destructive",
        });
        return;
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error("stripe-checkout network error", err);
      toast({
        title: "Network error",
        description: "Could not reach payment server.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 justify-center">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className="bg-slate-900/40 border border-slate-700 rounded-xl p-6 w-full md:w-80"
        >
          <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
          <p className="text-slate-300 mb-4 text-sm">{plan.desc}</p>
          <p className="text-3xl font-bold mb-6">{plan.priceLabel}</p>
          <Button className="w-full" onClick={() => handleCheckout(plan)}>
            Upgrade with Stripe
          </Button>
        </div>
      ))}
    </div>
  );
}
