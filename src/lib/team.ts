export type TeamMemberProgress = {
  user_id: string;
  full_name: string;
  dialed: number;
  calls_assigned: number;
  last_seen_at: string | null;
  updated_at: string | null;
};

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isMemberOnline(lastSeenAt: string | null, now = Date.now()) {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  return Number.isFinite(seen) && now - seen >= 0 && now - seen < ONLINE_WINDOW_MS;
}

export function summarizeTeamProgress(members: TeamMemberProgress[], now = Date.now()) {
  const dialed = members.reduce((sum, member) => sum + Math.max(0, member.dialed), 0);
  const assigned = members.reduce((sum, member) => sum + Math.max(0, member.calls_assigned), 0);
  return {
    dialed,
    assigned,
    percentage: assigned === 0 ? 0 : Math.round((dialed / assigned) * 100),
    online: members.filter((member) => isMemberOnline(member.last_seen_at, now)).length,
    targetsReached: members.filter(
      (member) => member.calls_assigned > 0 && member.dialed >= member.calls_assigned,
    ).length,
  };
}

export function crossedMilestones(previous: number, current: number, milestones: number[]) {
  return milestones.filter((milestone) => previous < milestone && current >= milestone);
}
