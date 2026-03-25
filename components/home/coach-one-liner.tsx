import { MessageCircle } from "lucide-react";

interface CoachOneLinerProps {
  coachName: string;
  oneLiner: string;
  isYesterday?: boolean;
}

export function CoachOneLiner({
  coachName,
  oneLiner,
  isYesterday = false,
}: CoachOneLinerProps) {
  return (
    <div className="mx-4 mt-4 p-4 bg-secondary/50 rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-semibold">{coachName}의 한마디</span>
          {isYesterday && (
            <span className="ml-2 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              어제 기준
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{oneLiner}</p>
    </div>
  );
}
