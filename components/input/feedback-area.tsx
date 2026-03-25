import { MessageCircle } from "lucide-react";

interface FeedbackAreaProps {
  feedback: string | null;
  coachName: string;
}

export function FeedbackArea({ feedback, coachName }: FeedbackAreaProps) {
  if (!feedback) return null;

  return (
    <div className="mx-4 mt-4 p-3 bg-navy-light/30 rounded-xl border border-navy/10">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-navy flex items-center justify-center flex-shrink-0 mt-0.5">
          <MessageCircle className="w-3 h-3 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium text-navy mb-0.5">{coachName}</p>
          <p className="text-sm leading-relaxed">{feedback}</p>
        </div>
      </div>
    </div>
  );
}
