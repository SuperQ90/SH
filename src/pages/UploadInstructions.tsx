import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Crown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUnderscores } from "@/lib/utils";

const UploadInstructions = () => {
  const { user, profile, loading } = useAuth();

  // determine if this user is a *new* free user (should be upload-limited)
  const email = (user?.email || "").toLowerCase();
  const isPledge = email.endsWith("@pledge.ai");
  const isAdminEmail = email === "mrutter@gmail.com";
  const isAdminRole = profile?.role === "admin";
  const isLegacyFree = profile?.subscription_status === "free_legacy";
  const isNewFree =
    !isAdminEmail &&
    !isPledge &&
    !isAdminRole &&
    !isLegacyFree &&
    (profile?.subscription_status === "free_new" ||
      profile?.plan_source === "auth_bootstrap");

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back to Home Button */}
          <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
            <Button variant="outline" asChild size="sm">
              <a href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </a>
            </Button>

            {/* show plan summary if we know it */}
            {user && !loading && (
              <div className="text-xs sm:text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-semibold text-foreground">
                  {user.email}
                </span>
                {profile?.subscription_status && (
                  <>
                    {" "}
                    • Plan:{" "}
                    <span className="uppercase">
                      {formatUnderscores(profile.subscription_status)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* If this is a NEW free user -> warn + upsell */}
          {isNewFree && (
            <Card className="mb-4 border-amber-500/50 bg-amber-950/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-amber-50">
                  <AlertCircle className="w-4 h-4" />
                  Uploads are limited on your current plan
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-100/90 space-y-2">
                <p>
                  You created your account after we locked down open uploads.
                  You can listen to everything, but to upload music you’ll need
                  to upgrade.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-amber-950"
                >
                  <a href="/pricing" className="flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    View premium plans
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="text-center mb-4 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3">
              <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              How to Upload Songs
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground">
              Share your{" "}
              <span
                className="text-green-400 font-bold animate-pulse"
                style={{
                  textShadow:
                    "0 0 10px #22c55e, 0 0 20px #22c55e, 0 0 30px #22c55e",
                }}
              >
                BEST MUSIC
              </span>{" "}
              with our community
            </p>
          </div>

          {/* AI Music Radio Image - Bigger on mobile, smaller on desktop */}
          <div className="mb-4 sm:mb-8 flex justify-center">
            <div className="w-3/4 sm:w-1/2">
              <img
                src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1755230475109_24a100b9.png"
                alt="AI Music Radio.io - Cosmic space background with metallic text"
                className="w-full h-auto object-cover rounded-lg shadow-lg"
              />
            </div>
          </div>

          {/* Text Instructions */}
          <div className="grid gap-3 sm:gap-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  Step-by-Step Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Create an Account
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Sign up for a free account to start uploading your
                        music.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Prepare Your Audio File
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Ensure your audio file is in MP3 or WAV format and under
                        20MB.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Click the Upload Button
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Find the "Add Music" button in the header and click it
                        to open the upload modal.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      4
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Fill in Song Details
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Enter the song title, artist name, select a genre, and
                        add your{" "}
                        <a
                          href="#brand-url"
                          className="text-primary hover:underline font-medium"
                        >
                          brand URL link
                        </a>
                        .
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      5
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Upload and Submit
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Select your audio file and click submit. Your song will
                        be processed and added to the platform.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      6
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Artist Name Benefits
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        When your artist name is selected, all of your songs
                        open in playlist for listener.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      7
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Brand URL Redirect
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        When your brand url link is selected, they will redirect
                        to that platform.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                      8
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        AI Music Creator Profiles
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        When we launch AI Music Creator Profiles, a url brand
                        link will be created for our platform for the AI Music
                        Creators profile page.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  Important Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 sm:space-y-2 text-muted-foreground">
                  <li
                    className="text-lg sm:text-2xl font-bold text-green-400 animate-pulse shadow-lg"
                    style={{
                      textShadow:
                        "0 0 10px #22c55e, 0 0 20px #22c55e, 0 0 30px #22c55e",
                    }}
                  >
                    • WE WANT YOUR BEST MUSIC, NOT YOUR EVERYDAY MUSIC
                  </li>
                  <li className="text-xs sm:text-sm">
                    • We will be implementing a filtering system to maintain
                    high quality on the platform
                  </li>
                  <li className="text-xs sm:text-sm">
                    • Only upload music you own or have permission to share
                  </li>
                  <li className="text-xs sm:text-sm">
                    • Audio files should be high quality (at least 128kbps)
                  </li>
                  <li className="text-xs sm:text-sm">
                    • Include accurate metadata (title, artist, genre)
                  </li>
                  <li className="text-xs sm:text-sm">
                    • Content must comply with our community guidelines
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-4 sm:mt-8 flex gap-3 justify-center">
            <Button asChild size="sm" className="sm:size-lg">
              <a href="/">Start Uploading Now</a>
            </Button>
            {isNewFree && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-amber-400/70 text-amber-100"
              >
                <a href="/pricing">Upgrade</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadInstructions;
