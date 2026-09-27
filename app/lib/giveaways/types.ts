export type GiveawayKind = "random" | "fcfs" | "contest" | "challenge" | "objective";
export type GiveawayStatus = "draft" | "scheduled" | "open" | "submissions_open" | "submissions_closed" | "voting_open" | "voting_closed" | "awaiting_claim" | "completed" | "cancelled" | "no_eligible_entries";
export type GiveawayWinnerMode = "random" | "fcfs" | "member_vote" | "ranked_vote" | "officer_vote" | "random_submission" | "objective";
export type GiveawayBallotPrivacy = "public" | "private" | "anonymous";
export type GiveawayBallotDetail = { id:number; voterLabel:string; selections:string[]; submittedAt:string; source:string; };

export type GiveawayPrizeInventoryItem = { id:number; name:string; category:string; donor:string|null; quantityAvailable:number; notes:string; };
export type GiveawayTemplate = { id:number; name:string; payload:Record<string,unknown>; };
export type GiveawayAuditEntry = { id:number; giveawayId:number|null; giveawayTitle:string|null; actionType:string; actorLabel:string|null; details:Record<string,unknown>; createdAt:string; };

export type GiveawayActor = {
  discordUserId: string | null;
  characterId: number | null;
  characterName: string | null;
  isOfficer: boolean;
  actorLabel: string;
};

export type GiveawayImage = {
  id: number;
  filename: string;
  sortOrder: number;
};

export type GiveawaySubmission = {
  id: number;
  characterId: number;
  characterName: string;
  discordUserId: string;
  title: string;
  description: string;
  status: string;
  galleryReviewStatus: string | null;
  images: GiveawayImage[];
  voteCount: number | null;
  viewerVoted: boolean;
  viewerRank: number | null;
  voteScore: number | null;
  objectiveScore: number | null;
  objectiveEvidence: string;
  objectiveVerified: boolean;
  isViewer: boolean;
};

export type GiveawayResult = {
  id: number;
  placement: number;
  resultKind: string;
  characterName: string;
  claimStatus: string;
  claimDeadline: string | null;
  public: boolean;
};

export type GiveawayRecord = {
  id: number;
  kind: GiveawayKind;
  status: GiveawayStatus;
  title: string;
  description: string;
  rules: string;
  theme: string | null;
  winnerMode: GiveawayWinnerMode;
  visibilityMode: "public" | "anonymous";
  ballotPrivacyMode: GiveawayBallotPrivacy;
  liveTotalsVisible: boolean;
  isTest: boolean;
  opensAt: string | null;
  closesAt: string | null;
  submissionOpensAt: string | null;
  submissionClosesAt: string | null;
  votingOpensAt: string | null;
  votingClosesAt: string | null;
  winnerCount: number;
  alternateCount: number;
  votesAllowed: number;
  placementCount: number;
  maxPhotos: number;
  maxEntriesPerMember: number;
  cooldownPolicy: "none" | "last_winner" | "7_days" | "14_days" | "30_days" | "60_days" | "90_days";
  claimPeriodEnabled: boolean;
  claimWindowHours: number | null;
  tiePolicy: string;
  qualificationInstructions: string;
  objectiveMetricLabel: string;
  objectiveDirection: "highest" | "lowest";
  evidenceRequired: boolean;
  postOpening: boolean;
  remindersEnabled: boolean;
  reminderMinutes: number[];
  postVotingOpen: boolean;
  discordContestGallery: boolean;
  discordVotingEnabled: boolean;
  postResults: boolean;
  discordAutoEnroll: boolean;
  discordSourceChannelId: string | null;
  prizeName: string;
  prizeQuantity: number;
  prizeCategory: string;
  prizeDonor: string | null;
  hasPrizeImage: boolean;
  entryCount: number;
  submissionCount: number;
  viewerEntered: boolean;
  viewerVotesUsed: number;
  remainingQuantity: number;
  submissions: GiveawaySubmission[];
  ballots: GiveawayBallotDetail[];
  results: GiveawayResult[];
  createdAt: string;
};

export type GiveawayDashboard = {
  active: GiveawayRecord[];
  upcoming: GiveawayRecord[];
  history: GiveawayRecord[];
  tests: GiveawayRecord[];
  eligibleMemberCount: number;
  viewerEligible: boolean;
  viewerEligibilityReason: string | null;
  prizeInventory: GiveawayPrizeInventoryItem[];
  templates: GiveawayTemplate[];
  audit: GiveawayAuditEntry[];
};
