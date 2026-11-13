import { MessageCircle, Target, UsersRound } from "lucide-react";
import { summarizeTeamProgress, type TeamMemberProgress } from "@/lib/team";

export function TeamGoal({
  members,
  currentUserId,
  ready,
  error,
  onOpenChat,
}: {
  members: TeamMemberProgress[];
  currentUserId: string;
  ready: boolean;
  error: string;
  onOpenChat: () => void;
}) {
  const summary = summarizeTeamProgress(members);
  const contributors = [...members].sort((a, b) => b.dialed - a.dialed || a.full_name.localeCompare(b.full_name));

  return (
    <section className="team-goal" aria-labelledby="team-goal-title">
      <div className="team-goal__overview">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="team-goal__eyebrow">
              <Target className="h-4 w-4" /> Shared daily target
            </p>
            <h2 id="team-goal-title" className="mt-2 text-xl font-bold text-foreground">
              Team goal
            </h2>
          </div>
          <span className="team-goal__live">
            <span className="status-dot status-dot--online" /> {summary.online} online
          </span>
        </div>

        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Syncing the team’s progress…</p>
        ) : error ? (
          <div className="mt-5">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button type="button" className="btn btn--outline mt-3" onClick={onOpenChat}>
              <MessageCircle className="h-4 w-4" /> Open team chat
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-end justify-between gap-3">
              <p className="team-goal__numbers">
                {summary.dialed} <span>/ {summary.assigned || "—"}</span>
              </p>
              <p className="team-goal__percentage">{summary.assigned ? `${summary.percentage}%` : "No target yet"}</p>
            </div>
            <div
              className="team-goal__track"
              role="progressbar"
              aria-label="Team daily call goal"
              aria-valuemin={0}
              aria-valuemax={summary.assigned || 0}
              aria-valuenow={Math.min(summary.dialed, summary.assigned)}
            >
              <span style={{ width: `${Math.min(100, summary.percentage)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.assigned
                ? `${summary.targetsReached} ${summary.targetsReached === 1 ? "caller has" : "callers have"} reached their personal target.`
                : "Add your assigned calls above to start the shared goal."}
            </p>
          </>
        )}
      </div>

      {ready && !error && members.length > 0 && (
        <div className="team-goal__contributors">
          <p className="team-goal__eyebrow">
            <UsersRound className="h-4 w-4" /> Caller progress
          </p>
          <div className="mt-3 space-y-3">
            {contributors.map((member) => {
              const percent = member.calls_assigned > 0 ? Math.round((member.dialed / member.calls_assigned) * 100) : 0;
              const reached = member.calls_assigned > 0 && member.dialed >= member.calls_assigned;
              return (
                <div key={member.user_id} className="caller-progress">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-foreground">
                      {member.full_name}{member.user_id === currentUserId ? " (you)" : ""}
                    </span>
                    <span className={reached ? "caller-progress__complete" : "shrink-0 text-muted-foreground"}>
                      {member.dialed}{member.calls_assigned > 0 ? ` / ${member.calls_assigned}` : " dialed"}
                    </span>
                  </div>
                  <div className="caller-progress__track">
                    <span className={reached ? "caller-progress__bar--complete" : ""} style={{ width: `${Math.min(100, percent)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
