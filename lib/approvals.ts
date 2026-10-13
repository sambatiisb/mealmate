export interface ApprovalResult {
  decided: boolean;
  passed: boolean;
  yesCount: number;
  noCount: number;
  pendingCount: number;
  totalMembers: number;
  tieBreak: boolean;
}

/**
 * Majority is computed against ALL quad members, not just those who voted —
 * silence counts as a non-vote, not an abstention. A quad only "decides" once
 * either side has a strict majority of all members, or every member has
 * responded and it's split exactly down the middle (even-sized quads only),
 * in which case it defaults to yes.
 */
export function computeApprovalResult(
  totalMembers: number,
  approvals: { approved: boolean }[]
): ApprovalResult {
  const yesCount = approvals.filter((a) => a.approved).length;
  const noCount = approvals.filter((a) => !a.approved).length;
  const pendingCount = totalMembers - yesCount - noCount;

  const majorityYes = yesCount > totalMembers / 2;
  const majorityNo = noCount > totalMembers / 2;
  const allResponded = pendingCount === 0;
  const exactTie = allResponded && yesCount === noCount;

  if (majorityYes) {
    return { decided: true, passed: true, yesCount, noCount, pendingCount, totalMembers, tieBreak: false };
  }
  if (majorityNo) {
    return { decided: true, passed: false, yesCount, noCount, pendingCount, totalMembers, tieBreak: false };
  }
  if (exactTie) {
    return { decided: true, passed: true, yesCount, noCount, pendingCount, totalMembers, tieBreak: true };
  }
  return { decided: false, passed: false, yesCount, noCount, pendingCount, totalMembers, tieBreak: false };
}
