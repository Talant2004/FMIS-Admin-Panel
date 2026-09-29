export type TeamLinkStatus = "pending" | "accepted"

export interface InspectorTeamLink {
  id: string
  userA: string
  userB: string
  fromUserId: string
  toUserId: string
  fromName: string
  toName: string
  fromOrganizationId?: string
  toOrganizationId?: string
  status: TeamLinkStatus
  createdAt: string
  respondedAt?: string
}

export function teamPairId(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`
}

export function otherTeamUserId(link: InspectorTeamLink, uid: string): string {
  if (link.fromUserId === uid) return link.toUserId
  if (link.toUserId === uid) return link.fromUserId
  return link.userA === uid ? link.userB : link.userA
}
