// src/components/TipArtistModal.tsx
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, Copy, ExternalLink } from "lucide-react";

interface PaymentMethod {
  venmo_username?: string | null;
  paypal_email?: string | null;
  cashapp_username?: string | null;
  zelle_email?: string | null;
  custom_payment_link?: string | null;
}

interface TipArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  paymentMethods: PaymentMethod | null;
}

const TipArtistModal: React.FC<TipArtistModalProps> = ({
  isOpen,
  onClose,
  artistName,
  paymentMethods,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const hasPaymentMethods =
    paymentMethods &&
    (paymentMethods.venmo_username ||
      paymentMethods.paypal_email ||
      paymentMethods.cashapp_username ||
      paymentMethods.zelle_email ||
      paymentMethods.custom_payment_link);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={[
          // mobile-friendly width, prevents horizontal scroll
          "w-[92vw] max-w-md sm:max-w-md",
          // allow vertical scrolling if it gets tall
          "max-h-[85vh] overflow-y-auto",
          // avoid horizontal overflow even with long URLs
          "overflow-x-hidden",
          "p-4 sm:p-6",
        ].join(" ")}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Support {artistName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose a payment method to send a tip or donation
          </p>

          {!hasPaymentMethods ? (
            <p className="text-center py-8 text-muted-foreground">
              This artist hasn't set up payment methods yet.
            </p>
          ) : (
            <div className="space-y-3">
              {paymentMethods?.venmo_username && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium">Venmo</div>
                    {/* break-all prevents long venmo URLs from overflowing on mobile */}
                    <div className="text-sm text-muted-foreground break-all whitespace-normal">
                      {paymentMethods.venmo_username}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(paymentMethods.venmo_username!, "venmo")
                    }
                  >
                    {copiedField === "venmo" ? (
                      "Copied!"
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {paymentMethods?.paypal_email && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium">PayPal</div>
                    <div className="text-sm text-muted-foreground break-all whitespace-normal">
                      {paymentMethods.paypal_email}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(paymentMethods.paypal_email!, "paypal")
                    }
                  >
                    {copiedField === "paypal" ? (
                      "Copied!"
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {paymentMethods?.cashapp_username && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium">Cash App</div>
                    <div className="text-sm text-muted-foreground break-all whitespace-normal">
                      {paymentMethods.cashapp_username}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        paymentMethods.cashapp_username!,
                        "cashapp"
                      )
                    }
                  >
                    {copiedField === "cashapp" ? (
                      "Copied!"
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {paymentMethods?.zelle_email && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium">Zelle</div>
                    <div className="text-sm text-muted-foreground break-all whitespace-normal">
                      {paymentMethods.zelle_email}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(paymentMethods.zelle_email!, "zelle")
                    }
                  >
                    {copiedField === "zelle" ? (
                      "Copied!"
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {paymentMethods?.custom_payment_link && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium">Custom Payment Link</div>
                    {/* allow arbitrary-length URLs without pushing the modal sideways */}
                    <div className="text-sm text-muted-foreground break-all whitespace-normal">
                      {paymentMethods.custom_payment_link}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(
                        paymentMethods.custom_payment_link!,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TipArtistModal;
