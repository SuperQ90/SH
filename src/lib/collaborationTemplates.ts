export type MessageThreadKind = "direct" | "collaboration";

export type CollaborationTemplate = {
  id: string;
  label: string;
  description: string;
  body: string;
};

export const COLLABORATION_TEMPLATES: CollaborationTemplate[] = [
  {
    id: "remix",
    label: "Remix collaboration",
    description: "Propose a remix of an existing track",
    body:
      "Hi! I'd love to collaborate on a remix. I think our styles could work well together. Are you open to discussing ideas and timelines?",
  },
  {
    id: "feature",
    label: "Feature / verse",
    description: "Ask to contribute vocals or a verse",
    body:
      "Hi! I'm interested in a feature collaboration — I'd like to contribute vocals/a verse to one of your tracks. Let me know if you're interested and we can share references.",
  },
  {
    id: "production",
    label: "Co-production",
    description: "Joint production on a new song",
    body:
      "Hi! Would you be interested in co-producing a track together? I can share some demos and we can figure out roles (writing, production, release plan).",
  },
  {
    id: "custom",
    label: "Custom proposal",
    description: "Write your own collaboration pitch",
    body: "",
  },
];
