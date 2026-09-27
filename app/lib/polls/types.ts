export type PollType = "single" | "multiple" | "yes_no" | "ranked" | "rating" | "image";
export type PollPrivacy = "public" | "private" | "anonymous";
export type PollResultsVisibility = "hidden_until_close" | "live" | "officer_only_until_close";
export type PollStatus = "draft" | "scheduled" | "open" | "awaiting_tie" | "closed" | "cancelled";

export type PollActor = {
  discordUserId: string | null;
  characterId: number | null;
  characterName: string | null;
  isOfficer: boolean;
  actorLabel: string;
};

export type PollChoice = {
  id: number;
  label: string;
  description: string;
  sortOrder: number;
  hasImage: boolean;
  voteCount: number | null;
  score: number | null;
  averageRating: number | null;
  viewerSelected: boolean;
  viewerRank: number | null;
};

export type PollBallotDetail = {
  id: number;
  voterLabel: string;
  selections: string[];
  submittedAt: string;
  source: string;
  counted: boolean;
  invalidationReason: string | null;
};

export type PollRecord = {
  id: number;
  status: PollStatus;
  pollType: PollType;
  question: string;
  description: string;
  privacyMode: PollPrivacy;
  resultsVisibility: PollResultsVisibility;
  maxSelections: number;
  winnerCount: number;
  minSelections: number | null;
  rankDepth: number;
  abstainEnabled: boolean;
  quorumMinimum: number | null;
  officerVotingEnabled: boolean;
  isTest: boolean;
  opensAt: string | null;
  closesAt: string;
  channelId: string;
  channelName: string;
  reminders: number[];
  postResults: boolean;
  voteCount: number;
  viewerHasBallot: boolean;
  viewerSelections: number[];
  viewerRanks: Record<number, number>;
  choices: PollChoice[];
  ballots: PollBallotDetail[];
  winnerChoiceId: number | null;
  winnerChoiceIds: number[];
  resolutionNote: string | null;
  extensionCount: number;
  materialLockedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type PollDashboard = {
  active: PollRecord[];
  upcoming: PollRecord[];
  history: PollRecord[];
  tests: PollRecord[];
  audit: Array<{ id: number; pollId: number | null; pollQuestion: string | null; actionType: string; actorLabel: string | null; details: Record<string, unknown>; createdAt: string }>;
  viewerEligible: boolean;
  viewerEligibilityReason: string | null;
};
