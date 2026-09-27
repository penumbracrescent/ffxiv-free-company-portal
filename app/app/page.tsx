import { Buffer } from "node:buffer";
import { syncGeneratedDefault } from "../lib/generated-defaults";
import PortalBrandingEditor from "./components/PortalBrandingEditor";
import { prepareBrandingImage, storeBrandingImage, validBrandingUrl } from "../lib/portal-branding";
import { Client } from "pg";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { CSSProperties } from "react";
import { auth, signIn, signOut } from "../auth";
import PartyPlannerPicker from "./components/PartyPlannerPicker";
import CharacterSwitcher from "./components/CharacterSwitcher";
import MemberDirectoryView from "./components/MemberDirectoryView";
import MountCharacterProgressList from "./components/MountCharacterProgressList";
import MemberEventWizard from "./components/MemberEventWizard";
import CraftingWorkshopView from "./components/CraftingWorkshopView";
import PortalCalculators from "./components/PortalCalculators";
import CommunityGalleryPostCard from "./components/CommunityGalleryPostCard";
import CommunityGalleryBrowser from "./components/CommunityGalleryBrowser";
import FcGalleryViewer from "./components/FcGalleryViewer";
import MarketboardMountGrid from "./marketboard-mount-grid";
import MarketboardMinionGrid from "./marketboard-minion-grid";
import MinionCollectionBrowser from "./components/MinionCollectionBrowser";
import MountCollectionBrowser from "./components/MountCollectionBrowser";
import AnimeReleaseCalendar from "./components/AnimeReleaseCalendar";
import GiveawaysView from "./components/GiveawaysView";
import PollsView from "./components/PollsView";
import OfficerActivityLog, { type OfficerActivityEntry, type OfficerActivityFilters, type OfficerCommandUsage } from "./components/OfficerActivityLog";
import DiscordResourceSelect from "./components/DiscordResourceSelect";
import AdministratorIdFields from "./components/AdministratorIdFields";
import StickerIdEditor from "./components/StickerIdEditor";
import ThemeEditor, { type ThemeEditorRole } from "./components/ThemeEditor";
import InteractiveFormEnhancer from "./components/InteractiveFormEnhancer";
import LiveBackgroundAction from "./components/LiveBackgroundAction";
import LiveCharacterFilters from "./components/LiveCharacterFilters";
import OfficerControlCenter from "./components/OfficerControlCenter";
import ClearBackupHistoryButton from "./components/ClearBackupHistoryButton";
import GuideLibrary from "./components/GuideLibrary";
import AchievementTitleTracker from "./components/AchievementTitleTracker";
import { ensureAchievementCollectionTables, getCollectionCatalogPage, type CollectionCatalogPage, type CollectionFilters } from "../lib/achievement-collections";
import DiscordLinkAssignmentForm, { type DiscordLinkAssignmentState } from "./components/DiscordLinkAssignmentForm";
import AvailabilityPanel from "./components/AvailabilityPanel";
import EventPlanningBoard from "./components/EventPlanningBoard";
import ResponsiveSidebar from "./components/ResponsiveSidebar";
import { ensureAvailabilityTables } from "../lib/availability";
import { ensureEventPlanningTables } from "../lib/event-plans";
import { getAvailableDiscordPostChannels } from "../lib/discord-channel-access";
import { ensureCraftingTables } from "../lib/crafting/schema";
import { ensureGiveawayTables } from "../lib/giveaways/schema";
import { ensurePollTables } from "../lib/polls/schema";
import { ensurePrivacyTables, isPrivacySuppressed } from "../lib/privacy";
import { erasePrivacySubject, minimizePrivacySubject } from "../lib/privacy-requests";
import { getGiveawayDashboard, getGiveawayEligibility } from "../lib/giveaways/service";
import { getPollDashboard, getPollEligibility } from "../lib/polls/service";
import { createCatalogCraftingRequest, createCraftingClaim, createDevelopmentWorkshopProject, deleteCraftingWorkshopProject, getCraftingWorkshopDashboard, recordCraftingContribution, recordPreviousPhaseProgress, publishCraftingProjectToDiscord, releaseCraftingClaim } from "../lib/crafting/service";
import type { CraftingActor } from "../lib/crafting/types";
import { isSetupMode } from "../lib/setup-security";
import { clearPortalBackupHistory, ensureBackupJobsTable, getPortalBackupJobs, requestPortalBackup as queuePortalBackup } from "../lib/backups";

export const dynamic = "force-dynamic";

const installationPortalName = String(process.env.PORTAL_NAME || "Free Company").trim() || "Free Company";
const installationPortalSubtitle = String(process.env.PORTAL_SUBTITLE || "Free Company Portal").trim() || "Free Company Portal";
const installationAuthProviderLabel = String(process.env.AUTH_PROVIDER || "discord").trim().toLowerCase() === "authentik" ? "Authentik" : "Discord";
const requestedDiscordCommandName = String(process.env.DISCORD_COMMAND_NAME || "fc").trim().toLowerCase();
const installationDiscordCommandName = /^[a-z0-9_-]{1,32}$/.test(requestedDiscordCommandName) ? requestedDiscordCommandName : "fc";
const legacyInstallationAdminDiscordIds = String(process.env.PORTAL_ADMIN_DISCORD_IDS || "").split(",").map((value) => value.trim()).filter((value) => /^\d{15,22}$/.test(value));
const requestedPrimaryAdminDiscordId = String(process.env.PORTAL_PRIMARY_ADMIN_DISCORD_ID || "").trim();
const installationPrimaryAdminDiscordId = /^\d{15,22}$/.test(requestedPrimaryAdminDiscordId) ? requestedPrimaryAdminDiscordId : legacyInstallationAdminDiscordIds[0] || "";
const installationPortalLogoUrl = String(process.env.PORTAL_LOGO_URL || "/branding/default-logo.svg").trim();
const installationPortalBannerUrl = String(process.env.PORTAL_BANNER_URL || "/branding/default-banner.svg").trim();
const portalMemberEmulationCookie = "portal_emulate_member";
const defaultWelcomeWaveStickerIds = "816087792291282944,754108890559283200,749054660769218631,781291131828699156,819128604311027752,751606379340365864,816086581509095424,781323769960202280,819130301702995968,772972089963577354,783787404518883338,831570715471380550,831571726223540294";
const installationPortalBackgroundColor = /^#[0-9a-f]{6}$/i.test(String(process.env.PORTAL_BACKGROUND_COLOR || ""))
  ? String(process.env.PORTAL_BACKGROUND_COLOR)
  : "#05000c";
const installationPortalAccentColor = /^#[0-9a-f]{6}$/i.test(String(process.env.PORTAL_ACCENT_COLOR || ""))
  ? String(process.env.PORTAL_ACCENT_COLOR)
  : "#9333ea";
const installationPortalTileColor = /^#[0-9a-f]{6}$/i.test(String(process.env.PORTAL_TILE_COLOR || ""))
  ? String(process.env.PORTAL_TILE_COLOR)
  : "#120423";

// ==================================================
// page.tsx organization notes
// ==================================================
// This file is intentionally labeled by numbered sections/subsections.
// Keep new database table creation in SECTION 04.
// Keep read-only database queries in SECTION 05.
// Keep form/server mutations in SECTION 06.
// Keep the rendered app shell in SECTION 07.
// ==================================================

// =========================
// SECTION 01: Types
// =========================

// -------------------------
// SUBSECTION 01A: Authentication and session types
// -------------------------

type PortalSession = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    groups?: string[];
    authentikSubject?: string | null;
    discordUserId?: string | null;
  };
} | null;

type PortalIdentityShadowStatus = {
  status:
    | "waiting_for_claim"
    | "unlinked"
    | "matched_current"
    | "matched_ineligible"
    | "unavailable";
  authentikSubjectReceived: boolean;
  discordClaimReceived: boolean;
  character_name: string | null;
  world: string | null;
};

type PortalEligibleMemberCharacter = {
  id: number;
  character_name: string;
  world: string;
};

type PortalMemberPreferences = {
  mountWinNotificationsEnabled: boolean;
  eventReminderLevel: "all" | "final" | "none";
  defaultEventRole: string;
  secondaryEventRole: string;
  eventTimeZone: string;
  motionPreference: "automatic" | "on" | "off";
  layoutDensity: "comfortable" | "compact";
  textScale: "standard" | "medium" | "large";
  highContrastEnabled: boolean;
  dataSaverEnabled: boolean;
  cardFlipEnabled: boolean;
  timeZoneMode: "central" | "local";
  timeFormat: "12" | "24";
  animeLanguage: "all" | "sub" | "dub";
  animePlatforms: string[];
  animeDefaultView: "upcoming" | "calendar";
  hideOwnedMounts: boolean;
  hideOwnedMinions: boolean;
  hideOwnedTitles: boolean;
  hideOwnedAchievements: boolean;
  defaultMountTab: "collection" | "marketboard";
  defaultMinionTab: "collection" | "marketboard";
  defaultMinionCategory: string;
  defaultLandingView: string;
  gamingSetupPublicEnabled: boolean;
  petPublicEnabled: boolean;
  glamourPublicEnabled: boolean;
  artworkPublicEnabled: boolean;
};

// -------------------------
// SUBSECTION 01B: Portal settings types
// -------------------------

type PortalSettings = {
  logoUrl: string;
  bannerUrl: string;
  backgroundColor: string;
  backgroundSecondaryColor: string;
  accentColor: string;
  tileColor: string;
  sidebarColor: string;
  insetColor: string;
  borderColor: string;
  headingColor: string;
  textColor: string;
  mutedTextColor: string;
  labelColor: string;
  additionalAdminDiscordIds: string;
  discordDisabledCommands: string[];
  discordInviteUrl: string;
  discordInvitePublic: boolean;
  raidProgressionText: string;
  raidScheduleText: string;
  raidExpectationsText: string;
  raidRecruitmentText: string;
  lodestoneUrl: string;
  recruitmentLodestoneUrl: string;
  directDiscordContactUrl: string;
  welcomeText: string;
  announcementText: string;
  fcAboutText: string;
  fcActivitiesText: string;
  fcScheduleText: string;
  fcRecruitmentText: string;
  fcHouseName: string;
  fcHouseLocation: string;
  fcHouseDescription: string;
  communityLinkOneLabel: string;
  communityLinkOneUrl: string;
  communityLinkTwoLabel: string;
  communityLinkTwoUrl: string;
  navigationOrder: PortalView[];
};

// -------------------------
// SUBSECTION 01C: Character, role, and sync types
// -------------------------

type PortalCharacter = {
  id: number;
  display_name: string;
  character_name: string;
  world: string;
  lodestone_character_id: string | null;
  ffxiv_collect_character_id: string | null;
  portrait_url: string | null;
  avatar_url: string | null;
  portrait_synced_at: string | null;
  authentik_email: string | null;
  role: string;
  fc_rank_name: string | null;
  fc_rank_changed_at: string | null;
  notes: string | null;
  active: boolean;
  mount_win_notifications_enabled: boolean;
  fc_membership_status: string;
  sync_status: string;
  last_fc_check_at: string | null;
  last_mount_sync_at: string | null;
  last_seen_in_fc_at: string | null;
  first_seen_in_fc_at: string | null;
  join_date_override: string | null;
  join_date_source: string;
  updated_at: string;
  linked_character_count: number;
};

type PortalRole = {
  name: string;
  sort_order: number;
};

type PortalSyncRun = {
  id: number;
  sync_type: string;
  status: string;
  message: string | null;
  started_at: string;
  finished_at: string | null;
};

type PortalAnimeSourceHealth = {
  source_key: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_result_count: number;
  consecutive_failures: number;
  retry_count: number;
  next_retry_at: string | null;
  last_error: string | null;
};

type PortalAnimeSyncRun = {
  id: number;
  run_kind: string;
  source_key: string | null;
  status: string;
  dry_run: boolean;
  started_at: string;
  completed_at: string | null;
  summary: Record<string, unknown>;
  error_text: string | null;
};

type PortalAnimeSyncStatus = {
  available: boolean;
  error: string | null;
  timezone: string;
  dailySyncTime: string;
  nextScheduledAt: string | null;
  backgroundSync: {
    status: "idle" | "running" | "success" | "failed" | "skipped";
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  };
  sources: PortalAnimeSourceHealth[];
  releases: {
    total: number;
    sub: number;
    dub: number;
    upcoming_discord_window: number;
    delayed: number;
    last_catalog_update: string | null;
  };
  recentRuns: PortalAnimeSyncRun[];
  outputs: Array<{ output_kind: string; output_language: string; mapped: number; last_synced_at: string | null; issues: number }>;
  sourceConfiguration: { animeScheduleTokenConfigured: boolean; officialFeedCount: number; ready: boolean };
  discord: { enabled: boolean; languages: string[]; horizonDays: number };
  google: { enabled: boolean; dryRun: boolean; credentialsConfigured: boolean; languages: string[]; calendars?: { sub?: { configured: boolean }; dub?: { configured: boolean } } };
};
type PortalFcRosterChange = {
  id: number;
  scan_source: string;
  change_type: "added" | "removed";
  character_name: string;
  world: string;
  lodestone_character_id: string | null;
  detected_at: string;
};

// -------------------------
// SUBSECTION 01D: Mount tracker summary/progress types
// -------------------------

type PortalMountSetSummary = {
  id: number;
  name: string;
  expansion: string;
  sort_order: number;
  mount_count: number;
  active_mount_count: number;
};

type PortalMountSetProgress = {
  id: number;
  name: string;
  expansion: string;
  sort_order: number;
  active_mount_count: number;
  tracked_characters: number;
  total_possible: number;
  owned_count: number;
  missing_count: number;
  collection_rate: number;
};

type PortalMountTrackerStats = {
  tracked_characters: number;
  total_mounts: number;
  total_possible: number;
  owned_count: number;
  missing_count: number;
  collection_rate: number;
};

type PortalCharacterMountProgress = {
  character_id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  sync_status: string;
  last_mount_sync_at: string | null;
  total_mounts: number;
  owned_mounts: number;
  missing_mounts: number;
  collection_rate: number;
};

type PortalMostNeededMount = {
  mount_id: number;
  mount_name: string;
  source_name: string | null;
  patch: string | null;
  icon_url: string | null;
  set_name: string;
  expansion: string;
  tracked_characters: number;
  owned_count: number;
  missing_count: number;
  missing_rate: number;
};

type PortalMountCategoryKey = "duty" | "achievement" | "crafting" | "gathering" | "tribal" | "island_sanctuary" | "pvp" | "event" | "quest" | "vendor" | "premium" | "gold_saucer" | "marketboard" | "other";
type PortalMountGuideStats = { tracked_characters: number; total_mounts: number; owned_count: number; total_possible: number; collection_rate: number };
type PortalMountCategoryProgress = { category_key: PortalMountCategoryKey; category_name: string; sort_order: number; mount_count: number; tracked_characters: number; owned_count: number };
type PortalMountGuideListing = { world_name: string; data_center_name: string | null; min_price: number };
type PortalMountAcquisitionCard = { id: number; mount_name: string; description: string | null; source_name: string | null; patch: string | null; icon_url: string | null; image_url: string | null; ffxiv_collect_mount_id: string | null; marketboard_item_name: string | null; marketboard_listings: PortalMountGuideListing[]; marketboard_faerie: PortalMountGuideListing | null; category_key: PortalMountCategoryKey; category_name: string; acquisition_data: PortalMinionAcquisitionSource[]; owned_by_viewer: boolean; fc_owned_count: number; tracked_characters: number; total_matches: number };

type PortalMinionCategoryKey = "farmable" | "gathering" | "gardening" | "crafting" | "tribal" | "island_sanctuary" | "pvp" | "event" | "quest" | "vendor" | "premium" | "achievement" | "gold_saucer" | "other";

type PortalMinionTrackerStats = {
  tracked_characters: number;
  total_minions: number;
  total_possible: number;
  owned_count: number;
  missing_count: number;
  collection_rate: number;
};

type PortalMinionCategoryProgress = {
  category_key: PortalMinionCategoryKey;
  category_name: string;
  sort_order: number;
  minion_count: number;
  tracked_characters: number;
  total_possible: number;
  owned_count: number;
  missing_count: number;
  collection_rate: number;
};

type PortalCharacterMinionProgress = {
  character_id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  sync_status: string;
  last_minion_sync_at: string | null;
  total_minions: number;
  owned_minions: number;
  missing_minions: number;
  collection_rate: number;
};

type PortalMostNeededMinion = {
  minion_id: number;
  minion_name: string;
  source_name: string | null;
  patch: string | null;
  icon_url: string | null;
  category_key: PortalMinionCategoryKey;
  category_name: string;
  tracked_characters: number;
  owned_count: number;
  missing_count: number;
  missing_rate: number;
};
type PortalMinionAcquisitionSource = {
  type: string;
  text: string;
  relatedType: string | null;
  relatedId: number | null;
  questName: string | null;
  questGiver: string | null;
  location: string | null;
  coordinates: string | null;
};

type PortalMinionMarketboardListing = {
  world_name: string;
  data_center_name: string | null;
  min_price: number;
};

type PortalMinionAcquisitionCard = {
  id: number;
  minion_name: string;
  description: string | null;
  source_name: string | null;
  patch: string | null;
  icon_url: string | null;
  image_url: string | null;
  ffxiv_collect_minion_id: string | null;
  marketboard_item_name: string | null;
  marketboard_listings: PortalMinionMarketboardListing[];
  marketboard_faerie: PortalMinionMarketboardListing | null;
  category_key: PortalMinionCategoryKey;
  category_name: string;
  acquisition_data: PortalMinionAcquisitionSource[];
  owned_by_viewer: boolean;
  fc_owned_count: number;
  tracked_characters: number;
  total_matches: number;
};
type PortalManagedMount = {
  id: number;
  mount_name: string;
  source_name: string | null;
  patch: string | null;
  mount_category: string;
  farm_priority: string;
  active: boolean;
  manual_override: boolean;
  set_name: string | null;
  expansion: string | null;
};

type PortalMountWinTestOption = {
  id: number;
  mount_name: string;
  source_name: string | null;
  image_url: string | null;
  icon_url: string | null;
  set_name: string | null;
  expansion: string | null;
};
type PortalManagedMountFilters = {
  search: string;
  category: string;
  farmPriority: string;
  visibility: string;
  overrideStatus: string;
};

type PortalCharacterMountDetailMount = {
  id: number;
  mount_name: string;
  source_name: string | null;
  patch: string | null;
  icon_url: string | null;
  owned: boolean;
};

type PortalCharacterMountDetailSet = {
  id: number;
  name: string;
  expansion: string;
  sort_order: number;
  total_mounts: number;
  owned_mounts: number;
  missing_mounts: number;
  collection_rate: number;
  mounts: PortalCharacterMountDetailMount[];
};

type PortalCharacterMountDetails = {
  character_id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  sync_status: string;
  last_mount_sync_at: string | null;
  sets: PortalCharacterMountDetailSet[];
};

// -------------------------
// SUBSECTION 01E: Filter types
// -------------------------

type CharacterFilters = {
  characterSearch?: string;
  roleFilter?: string;
  statusFilter?: string;
};

type PortalMountTrackerFilters = {
  search: string;
  role: string;
  syncStatus: string;
};

// -------------------------
// SUBSECTION 01F: Mount acquisition and Discord announcement types
// -------------------------

type PortalMountAcquisition = {
  id: number;
  character_id: number;
  mount_id: number;
  character_name: string;
  mount_name: string;
  source_name: string | null;
  set_name: string | null;
  expansion: string | null;
  detected_at: string;
  is_test: boolean;
  discord_sent_at: string | null;
  discord_error: string | null;
};

type PortalAnnouncement = {
  id: number;
  title: string;
  body: string;
  category: string;
  created_by: string | null;
  published_at: string;
};

type PortalAnnouncementEvent = {
  id: number;
  event_type: string;
  title: string;
  description: string;
  duty_name: string | null;
  mount_name: string | null;
  event_starts_at: string;
};

type PortalAnnouncementRename = {
  id: number;
  old_name: string;
  new_name: string;
  detected_at: string;
  portrait_url: string | null;
};

type PortalFcInfoCard = {
  id: number;
  label: string;
  title: string;
  body: string;
  sort_order: number;
};

type PortalFcInfoLead = {
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  portrait_url: string | null;
};

type PortalGuideResource = {
  id: number;
  category: string;
  title: string;
  body: string;
  url: string | null;
  sort_order: number;
  visibility_mode: "public" | "members";
};

type PortalGalleryImage = {
  id: number;
  title: string;
  alt_text: string;
  mime_type: string;
  created_by: string | null;
  created_at: string;
};

type PortalCommunityGalleryImage = {
  id: number;
  filename: string;
};

type PortalCommunityGalleryPost = {
  id: number;
  category: "gaming_setup" | "pet" | "glamour" | "artwork";
  discord_display_name: string;
  character_name: string | null;
  display_name_override: string | null;
  caption: string | null;
  posted_at: string;
  review_status: "pending" | "approved" | "rejected";
  review_note: string | null;
  artwork_public_enabled: boolean;
  images: PortalCommunityGalleryImage[];
};

type PortalCommunityGalleryImport = {
  category: "gaming_setup" | "pet" | "glamour";
  status: "pending" | "running" | "completed" | "failed";
  scanned_messages: number;
  imported_posts: number;
  requested_at: string;
  completed_at: string | null;
  error_text: string | null;
};

type PortalLinkCard = {
  id: number;
  label: string;
  url: string;
  description: string | null;
  sort_order: number;
  has_custom_image: boolean;
  created_at: string;
};

// -------------------------
// SUBSECTION 01G: Party planner types
// -------------------------

type PortalPartyCharacterOption = {
  id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  sync_status: string;
  owner_key: string;
};

type PortalFcVerification = {
  fc_lodestone_id: string;
  lodestone_url: string;
  discord_guild_id: string;
  world: string;
  datacenter: string;
  verification_code: string;
  status: "pending" | "verified";
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

type PortalPartyFarmTarget = {
  mount_id: number;
  mount_name: string;
  source_name: string | null;
  patch: string | null;
  icon_url: string | null;
  set_name: string;
  expansion: string;
  selected_count: number;
  missing_count: number;
  owned_count: number;
  missing_names: string[];
  owned_names: string[];
};

// -------------------------
// SUBSECTION 01H: View routing and navigation types
// -------------------------

type PortalView =
  | "home"
  | "announcements"
  | "polls"
  | "events"
  | "crafting"
  | "calculators"
  | "guides"
  | "members"
  | "mounts"
  | "minions"
  | "titles"
  | "achievements"
  | "anime"
  | "giveaways"
  | "fc-info"
  | "links"
  | "gallery"
  | "settings"
  | "officers";

type PortalNavItem = {
  label: string;
  icon: string;
  view: PortalView;
};

type PortalOfficerNavItem = {
  label: string;
  icon: string;
  anchor: string;
  description: string;
};

// -------------------------
// SUBSECTION 01I: Member directory and join date types
// -------------------------

type PortalMemberDirectoryFilters = {
  search: string;
  role: string;
  syncStatus: string;
};

type PortalMemberDirectoryCharacter = {
  id: number;
  display_name: string;
  character_name: string;
  world: string;
  portrait_url: string | null;
  avatar_url: string | null;
  portrait_synced_at: string | null;
  role: string;
  fc_rank_name: string | null;
  fc_rank_changed_at: string | null;
  sync_status: string;
  first_seen_in_fc_at: string | null;
  join_date_override: string | null;
  join_date_source: string;
  last_seen_in_fc_at: string | null;
  last_mount_sync_at: string | null;
  total_mounts: number;
  owned_mounts: number;
  missing_mounts: number;
  collection_rate: number;
  rename_history: PortalCharacterRenameHistory[];
  rank_history: PortalCharacterFcRankHistory[];
  is_current_fc_member: boolean;
  linked_to_character_name: string | null;
  linked_characters: { id: number; character_name: string; world: string }[];
};

type PortalCharacterFcRankHistory = {
  id: number;
  old_rank_name: string;
  new_rank_name: string;
  old_rank_started_at: string | null;
  detected_at: string;
};

type PortalCharacterRenameHistory = {
  id: number;
  old_name: string;
  new_name: string;
  detected_at: string;
};

type PortalCharacterRenameReview = PortalCharacterRenameHistory & {
  character_id: number;
  character_name: string;
  display_name: string;
  portrait_url: string | null;
  discord_user_id: string | null;
  notification_status: string;
  confirmation_status: string;
  confirmed_at: string | null;
};

type PortalJoinDateCharacter = {
  id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  first_seen_in_fc_at: string | null;
  last_seen_in_fc_at: string | null;
  join_date_override: string | null;
  join_date_source: string;
};

// -------------------------
// SUBSECTION 01J: Discord automation types
// -------------------------

type PortalDiscordLink = {
  discord_user_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
  discord_nickname: string | null;
  discord_display_name: string | null;
  character_id: number | null;
  character_name: string | null;
  world: string | null;
  role: string | null;
  match_source: string;
  matched_at: string | null;
  last_seen_at: string;
};

type PortalDiscordAuditLog = {
  id: number;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_global_name: string | null;
  discord_nickname: string | null;
  discord_display_name: string | null;
  submitted_character_name: string | null;
  character_id: number | null;
  character_name: string | null;
  attempt_type: string;
  result: string;
  reason: string | null;
  created_at: string;
};

// -------------------------
// SUBSECTION 01K: Discord bot settings types
// -------------------------

type PortalDiscordBotSettings = {
  guild_id: string;
  verified_role_id: string;
  unverified_role_id: string;
  temp_access_role_id: string;
  temporary_guest_enabled: boolean;
  onboarding_selection_minutes: number;
  temp_guest_hours: number;
  welcome_channel_id: string;
  free_company_chat_channel_id: string;
  welcome_engagement_enabled: boolean;
  welcome_wave_sticker_ids: string;
  officer_log_channel_id: string;
  event_channel_id: string;
  raid_channel_id: string;
  mount_farm_channel_id: string;
  mount_win_channel_id: string;
  mount_win_announcements_enabled: boolean;
  anime_event_scheduling_enabled: boolean;
  crafting_channel_id: string;
  treasure_map_channel_id: string;
  treasure_map_auto_enabled: boolean;
  roster_review_channel_id: string;
  test_channel_id: string;
  member_rename_notification_channel_id: string;
  gaming_setups_channel_id: string;
  pets_gallery_channel_id: string;
  glamours_gallery_channel_id: string;
  artwork_gallery_channel_id: string;
  giveaway_channel_id: string;
  contestants_channel_id: string;
  fashion_report_channel_id: string;
  fashion_report_enabled: boolean;
  anime_ranking_channel_id: string;
  anime_ranking_enabled: boolean;
  anime_ranking_thread_enabled: boolean;
  lodestone_news_channel_id: string;
  lodestone_news_enabled: boolean;
  notification_window_enabled: boolean;
  notification_window_start_time: string;
  notification_window_end_time: string;
  rename_notifications_discord_members_enabled: boolean;
  rename_notifications_non_discord_members_enabled: boolean;
  auto_rename_enabled: boolean;
  auto_role_enabled: boolean;
  startup_member_sync_enabled: boolean;
  log_unmatched_attempts: boolean;
  auto_roster_scan_enabled: boolean;
  roster_scan_interval_hours: number;
  alt_character_claims_enabled: boolean;
  alt_character_default_limit: number;
  alt_character_verification_mode: string;
  alt_character_code_expiry_minutes: number;
};
type PortalCollectionSourceWarning = {
  id: number; catalog_name: string; source_type: string; affected_count: number;
  example_items: string[]; first_observed_at: string; last_observed_at: string; resolved_at: string | null;
};

type DiscordResourceOption = {
  id: string;
  label: string;
};

type PortalDiscordResourceDiscovery = {
  guildName: string;
  roles: DiscordResourceOption[];
  channels: DiscordResourceOption[];
  warnings: string[];
  error: string | null;
};

// -------------------------
// SUBSECTION 01L: Discord Roster Review Types
// -------------------------

type PortalDiscordRosterReview = {
  discord_user_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
  discord_nickname: string | null;
  discord_display_name: string | null;
  character_id: number | null;
  character_name: string | null;
  world: string | null;
  role: string | null;
  active: boolean | null;
  fc_membership_status: string | null;
  last_seen_in_fc_at: string | null;
  matched_at: string | null;
  last_seen_at: string;
  review_decision: string | null;
  review_note: string | null;
  review_decided_at: string | null;
  review_decided_by: string | null;
  review_reason: string;
};

// -------------------------
// SUBSECTION 01M: Discord action queue types
// -------------------------

type PortalDiscordQueueStats = {
  pending: number;
  needs_confirmation: number;
  processing: number;
  failed: number;
  completed: number;
  cancelled: number;
  total_open: number;
};

type PortalDiscordMemberSnapshotReview = {
  discord_user_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
  discord_nickname: string | null;
  discord_display_name: string | null;
  is_bot: boolean;
  has_verified_role: boolean;
  has_unverified_role: boolean;
  linked_character_id: number | null;
  linked_character_name: string | null;
  linked_world: string | null;
  linked_fc_status: string | null;
  linked_active: boolean | null;
  review_status: string;
  review_reason: string | null;
  last_scanned_at: string | null;
};

type PortalDiscordActionQueueItem = {
  id: number;
  discord_user_id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  character_name: string | null;
  action_type: string;
  status: string;
  requested_by: string | null;
  requested_at: string;
  completed_at: string | null;
  result_message: string | null;
  error_message: string | null;
  action_note: string | null;
};

type PortalDiscordRosterScanStatus = {
  last_requested_at: string | null;
  last_completed_at: string | null;
  last_status: string | null;
  last_requested_by: string | null;
  last_result_message: string | null;
  last_error_message: string | null;
  next_due_at: string | null;
};

type PortalDiscordScheduledPost = {
  id: number;
  post_type: string;
  title: string;
  message: string;
  embed_image_url: string | null;
  thumbnail_image_url: string | null;
  target_channel_kind: string;
  target_channel_id: string;
  scheduled_for: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  sent_message_id: string | null;
  error_message: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  event_id: number | null;
  reminder_offset_minutes: number | null;
};

type PortalDiscordEvent = {
  id: number;
  event_type: string;
  title: string;
  description: string;
  level: number | null;
  level_max: number | null;
  event_time_zone: string;
  duty_id: number | null;
  duty_name: string | null;
  duty_image_url: string | null;
  target_channel_kind: string;
  target_channel_id: string;
  event_starts_at: string;
  event_ends_at: string | null;
  announcement_post_at: string | null;
  announcement_scheduled_post_id: number | null;
  party_strategy: string;
  party_size: number;
  standard_party_roles_required: boolean;
  check_in_required: boolean;
  roster_locked: boolean;
  series_id: number | null;
  series_name: string | null;
  series_occurrence_number: number | null;
  mount_id: number | null;
  reminder_24h_enabled: boolean;
  reminder_1h_enabled: boolean;
  last_edited_at: string | null;
  last_edited_by: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  expired_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
};

type PortalEventTemplate = {
  id: number;
  name: string;
  event_type: string;
  title: string;
  description: string;
  level: number | null;
  duty_id: number | null;
  duty_name: string | null;
  mount_id: number | null;
  mount_name: string | null;
  target_channel_kind: string;
  party_strategy: string;
  party_size: number;
  standard_party_roles_required: boolean;
  check_in_required: boolean;
  reminder_24h_enabled: boolean;
  reminder_1h_enabled: boolean;
  announcement_lead_minutes: number;
  created_by: string | null;
  updated_at: string;
};

type PortalEventSeries = {
  id: number;
  series_name: string;
  recurrence_kind: string;
  next_occurrence_at: string;
  end_at: string | null;
  occurrences_ahead: number;
  active: boolean;
  generated_count: number;
  last_generated_at: string | null;
  created_by: string | null;
  paused_at: string | null;
  ended_at: string | null;
};
type PortalEventSignup = {
  character_id: number;
  character_name: string;
  world: string;
  signup_status: string;
  role_preference: string;
  secondary_role_preference: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  needs_target_mount: boolean | null;
  roster_state: string;
  party_number: number | null;
  completed_at: string | null;
  completed_by: string | null;
  attendance_status: string;
  checked_in_at: string | null;
  attendance_updated_at: string | null;
  attendance_updated_by: string | null;
};

type PortalMountNeedSuggestion = {
  mount_id: number;
  mount_name: string;
  source_name: string | null;
  need_count: number;
};

type PortalMemberEvent = PortalDiscordEvent & {
  mount_id: number | null;
  mount_name: string | null;
  mount_source_name: string | null;
  mount_image_url: string | null;
  mount_suggestions: PortalMountNeedSuggestion[];
  signups: PortalEventSignup[];
  current_signup: PortalEventSignup | null;
};

type PortalMemberEventsData = {
  character: {
    id: number;
    character_name: string;
    world: string;
  } | null;
  events: PortalMemberEvent[];
};
type PortalDiscordEventMount = {
  event_id: number;
  mount_id: number;
  mount_name: string;
  source_name: string | null;
  icon_url: string | null;
  image_url: string | null;
  sort_order: number;
};

type PortalDiscordEventMountOption = {
  id: number;
  mount_name: string;
  source_name: string | null;
  icon_url: string | null;
  image_url: string | null;
  set_name: string | null;
  expansion: string | null;
};

type PortalDiscordDuty = {
  id: number;
  duty_type: string;
  name: string;
  expansion: string | null;
  level: number | null;
  party_size: number | null;
  image_url: string | null;
  notes: string | null;
  active: boolean;
  sort_order: number;
  external_source: string | null;
  external_id: string | null;
  image_override_url: string | null;
  manual_override: boolean;
  last_synced_at: string | null;
};

// =========================
// SECTION 02: Defaults and Navigation
// =========================

// -------------------------
// SUBSECTION 02A: General portal defaults
// -------------------------

const defaultWorld = String(process.env.DEFAULT_WORLD || "Faerie").trim() || "Faerie";
const defaultDataCenter = String(process.env.DEFAULT_DATACENTER || "Aether").trim() || "Aether";

const discordCommandOptions = [
  { name: "me", label: "My Overview", description: "Linked-character overview and personal FC activity." },
  { name: "status", label: "Connection Status", description: "Portal, Discord role, and FC roster connection status." },
  { name: "character", label: "Additional Characters", description: "Find and claim another FFXIV character." },
  { name: "craftmacro", label: "Crafting Macros", description: "Generate crafting macros and save crafter stats." },
  { name: "chocobocolor", label: "Chocobo Color", description: "Calculate a private fruit feeding order for a target plumage color." },
  { name: "map", label: "Treasure Map Identification", description: "Privately identify an attached treasure-map screenshot." },
  { name: "planevent", label: "Plan Event", description: "Create an FC duty run or farm-party plan." },
  { name: "events", label: "Events", description: "Show upcoming FC events." },
  { name: "animeschedule", label: "Anime Schedule", description: "Browse the anime release schedule by day." },
  { name: "giveaways", label: "Giveaways", description: "Show active giveaways and contests." },
  { name: "entries", label: "Giveaway Entries", description: "Show a member''s giveaway and contest activity." },
  { name: "mounts", label: "Mounts", description: "Browse a member''s tracked mount collection." },
  { name: "minions", label: "Minions", description: "Browse a member''s minion collection and sources." },
  { name: "mountalerts", label: "Mount Alerts", description: "View or change mount-win notifications." },
  { name: "share", label: "Share Catalog Cards", description: "Preview and post duty, mount, or minion cards." },
  { name: "links", label: "Portal Links", description: "Open useful portal pages." },
  { name: "about", label: "About", description: "Explain what the FC bot handles.", required: true },
  { name: "privacy", label: "Privacy", description: "Explain what data the bot and portal use.", required: true }
] as const;
const disableableDiscordCommands = new Set(discordCommandOptions.filter((command) => !("required" in command && command.required)).map((command) => command.name));

// -------------------------
// SUBSECTION 02B: Default editable portal settings
// -------------------------

const defaultSettings: PortalSettings = {
  logoUrl: installationPortalLogoUrl,
  bannerUrl: installationPortalBannerUrl,
  backgroundColor: installationPortalBackgroundColor,
  backgroundSecondaryColor: installationPortalBackgroundColor,
  accentColor: installationPortalAccentColor,
  tileColor: installationPortalTileColor,
  sidebarColor: installationPortalTileColor,
  insetColor: installationPortalBackgroundColor,
  borderColor: installationPortalAccentColor,
  headingColor: "#fff7ff",
  textColor: "#f4eaf7",
  mutedTextColor: "#cdbbd9",
  labelColor: installationPortalAccentColor,
  additionalAdminDiscordIds: "",
  discordDisabledCommands: [],
  discordInviteUrl: "",
  discordInvitePublic: true,
  raidProgressionText: "Current progression and goals will be posted here as the raid group begins its next tier.",
  raidScheduleText: "Raid nights and learning runs are scheduled through the FC event calendar and Discord.",
  raidExpectationsText: "Bring a respectful, patient mindset. We value clear communication, learning together, and celebrating steady progress.",
  raidRecruitmentText: "We welcome members interested in learning, farming, and clearing together. Join an upcoming event or introduce yourself in Discord.",
  lodestoneUrl: String(process.env.FC_LODESTONE_URL || "").trim(),
  recruitmentLodestoneUrl: "",
  directDiscordContactUrl: "",
  welcomeText:
    "A close-knit Free Company focused on community, fun, raids, mount farms, crafting, and making memories together.",
  announcementText:
    `${installationPortalName}'s portal is online. Member tools, events, and collection tracking are available here.`,
  fcAboutText:
    `${installationPortalName} is a community-first Free Company built around making memories and helping one another enjoy Eorzea.`,
  fcActivitiesText:
    "We run raids, trials, mount farms, crafting and gathering sessions, and relaxed social events for members of every experience level.",
  fcScheduleText:
    "Upcoming adventures are posted on the portal and in Discord. Check the Announcements page to see what the FC is planning next.",
  fcRecruitmentText:
    `Looking for a welcoming group to explore Eorzea with? Visit our Discord, say hello, and see whether ${installationPortalName} feels like home.`,
  fcHouseName: `${installationPortalName} FC House`,
  fcHouseLocation: defaultWorld,
  fcHouseDescription: "Our shared home for crafting, gathering, social time, and the adventures in between.",
  communityLinkOneLabel: "",
  communityLinkOneUrl: "",
  communityLinkTwoLabel: "",
  communityLinkTwoUrl: "",
  navigationOrder: []
};

// -------------------------
// SUBSECTION 02C: Default role list
// -------------------------

const defaultRoles: PortalRole[] = [
  { name: "Member", sort_order: 10 },
  { name: "Officer", sort_order: 20 },
  { name: "Raid Lead", sort_order: 30 },
  { name: "Crafter", sort_order: 40 },
  { name: "Alt", sort_order: 50 }
];

// -------------------------
// SUBSECTION 02D: Sidebar navigation items
// -------------------------

const publicNavItems: PortalNavItem[] = [
  { label: "Home", icon: "\u2302", view: "home" },
  { label: "Announcements", icon: "\u25C6", view: "announcements" },
  { label: "Polls", icon: "\u2611", view: "polls" },
  { label: "Events & Raiding", icon: "\u2694", view: "events" },
  { label: "Giveaways & Contests", icon: "\u2605", view: "giveaways" },
  { label: "Anime Calendar", icon: "\u25B6", view: "anime" },
  { label: "Guides & Resources", icon: "\u263D", view: "guides" },
  { label: "Collections", icon: "\u2726", view: "mounts" },
  { label: "FC Information", icon: "\u2727", view: "fc-info" },
  { label: "Links", icon: "\u2197", view: "links" },
  { label: "Community Gallery", icon: "\u2726", view: "gallery" }
];

const memberNavItems: PortalNavItem[] = [
  { label: "Home", icon: "\u2302", view: "home" },
  { label: "Announcements", icon: "\u25C6", view: "announcements" },
  { label: "Polls", icon: "\u2611", view: "polls" },
  { label: "Events & Raiding", icon: "\u2694", view: "events" },
  { label: "Giveaways & Contests", icon: "\u2605", view: "giveaways" },
  { label: "Anime Calendar", icon: "\u25B6", view: "anime" },
  { label: "Crafting & Gathering", icon: "\u2692", view: "crafting" },
  { label: "Tools & Calculators", icon: "\u2699", view: "calculators" },
  { label: "Guides & Resources", icon: "\u263D", view: "guides" },
  { label: "Members", icon: "\u2662", view: "members" },
  { label: "Collections", icon: "\u2726", view: "mounts" },
  { label: "FC Information", icon: "\u2727", view: "fc-info" },
  { label: "Links", icon: "\u2197", view: "links" },
  { label: "Community Gallery", icon: "\u2726", view: "gallery" },
  { label: "Settings", icon: "\u2699", view: "settings" }
];
const defaultNavigationOrder = memberNavItems.map((item) => item.view);
const normalizeNavigationOrder = (requested: PortalView[]) => {
  const allowed = new Set(defaultNavigationOrder);
  return [...new Set(requested.filter((view) => allowed.has(view))), ...defaultNavigationOrder.filter((view) => !requested.includes(view))];
};
const orderNavigationItems = (items: PortalNavItem[], requested: PortalView[]) => {
  const positions = new Map(normalizeNavigationOrder(requested).map((view, index) => [view, index]));
  return [...items].sort((left, right) => (positions.get(left.view) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.view) ?? Number.MAX_SAFE_INTEGER));
};
const officerNavItems: PortalOfficerNavItem[] = [
  { label: "Sync Status", icon: "\u21BB", anchor: "officer-sync-status", description: "Verify FC ownership on Lodestone and monitor worker synchronization." },
  { label: "Activity Log", icon: "\u2637", anchor: "officer-activity-log", description: "Search command results, bot activity, roster changes, events, giveaways, and sync runs." },
  { label: "Join Dates", icon: "\u25C6", anchor: "officer-join-dates", description: "Set known FC join dates for member cards." },
  { label: "Discord Automation", icon: "\u2699", anchor: "officer-discord-automation", description: "Review verified Discord links and bot activity." },
  { label: "Bot Settings", icon: "\u2699", anchor: "officer-discord-bot-settings", description: "Configure Discord server, role, and channel IDs." },
  { label: "Scan Status", icon: "\u25CE", anchor: "officer-discord-scan-status", description: "Check the latest roster scan and next automatic scan." },
  { label: "Scheduled Posts", icon: "\u2709", anchor: "officer-discord-scheduled-posts", description: "Create future Discord announcements and reminders." },
  { label: "Action Queue", icon: "\u2022", anchor: "officer-discord-action-queue", description: "Review pending bot actions and retry or cancel them." },
  { label: "Roster Scan", icon: "\u21BB", anchor: "officer-discord-roster-scan", description: "Queue a Discord server roster scan." },
  { label: "Roster Review", icon: "\u2713", anchor: "officer-discord-roster-review", description: "Review Discord users linked to invalid FC records." },
  { label: "Portal Settings", icon: "\u2699", anchor: "officer-portal-settings", description: "Edit portal text and public links." },
  { label: "Mount Management", icon: "\u265E", anchor: "officer-mount-management", description: "Override mount visibility and farm priority." },
  { label: "Roles", icon: "\u2662", anchor: "officer-role-settings", description: "Edit character role dropdown options." },
  { label: "Characters", icon: "\u263A", anchor: "officer-character-manager", description: "Add, edit, filter, and remove FC characters." },
  { label: "Events", icon: "\u2694", anchor: "officer-discord-events", description: "Plan raid and mount farm events." },
  { label: "Duty Catalog", icon: "\u25C6", anchor: "officer-discord-duty-catalog", description: "Manage duty, raid, and trial dropdown options." }
];

// =========================
// SECTION 03: Shared Helpers
// =========================

// -------------------------
// SUBSECTION 03A: Permission helpers
// -------------------------

function hasAnyGroup(userGroups: string[], allowedGroups: string[]) {
  return allowedGroups.some((group) => userGroups.includes(group));
}

function getUserGroupsFromSession(session: PortalSession) {
  return (session?.user?.groups ?? []).filter(Boolean);
}

// -------------------------
// SUBSECTION 03B: Date formatting helpers
// -------------------------

const portalDisplayTimeZone = "America/Chicago";

function formatShortDate(value: string | null) {
  if (!value) return "Unknown";

  return new Date(value).toLocaleDateString("en-US", {
    timeZone: portalDisplayTimeZone,
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatShortDateTime(value: string | null) {
  if (!value) return "Unknown";

  return new Date(value).toLocaleString("en-US", {
    timeZone: portalDisplayTimeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatEventLevelRange(level: number | null, levelMax: number | null) {
  if (level !== null && levelMax !== null) return `Levels ${level}–${levelMax}`;
  if (level !== null) return `Level ${level}`;
  if (levelMax !== null) return `Up to level ${levelMax}`;
  return "No level requirement";
}

function formatDiscordEventTime(value: string | Date) {
  const timestamp = Math.floor(new Date(value).getTime() / 1000);
  return `<t:${timestamp}:F>`;
}

function formatAnimeOutputRunSummary(summary: Record<string, unknown>) {
  const fields: Array<[string, string]> = [
    ["desired", "desired"], ["created", "created"], ["updated", "updated"],
    ["unchanged", "unchanged"], ["retired", "retired"], ["skipped", "skipped"], ["failed", "failed"]
  ];
  return fields
    .filter(([key]) => Object.prototype.hasOwnProperty.call(summary, key))
    .map(([key, label]) => `${Number(summary[key] || 0)} ${label}`)
    .join(" · ");
}

function buildSuggestedEventParties(signups: PortalEventSignup[], partySize = 8) {
  if (signups.length === 0) return [];

  const partyCount = Math.ceil(signups.length / partySize);
  const parties: PortalEventSignup[][] = Array.from({ length: partyCount }, () => []);
  const roleOrder = ["tank", "healer", "melee_dps", "ranged_dps", "caster", "flexible"];
  const ordered = [...signups].sort((a, b) => {
    const needDifference = Number(b.needs_target_mount === true) - Number(a.needs_target_mount === true);
    if (needDifference !== 0) return needDifference;
    const roleDifference = roleOrder.indexOf(a.role_preference) - roleOrder.indexOf(b.role_preference);
    if (roleDifference !== 0) return roleDifference;
    return a.character_name.localeCompare(b.character_name);
  });

  for (const signup of ordered) {
    const eligible = parties.filter((party) => party.length < partySize);
    const preferred = signup.role_preference === "tank" || signup.role_preference === "healer"
      ? eligible.filter((party) => !party.some((member) => member.role_preference === signup.role_preference))
      : eligible;
    const candidates = preferred.length > 0 ? preferred : eligible;
    candidates.sort((a, b) => a.length - b.length);
    candidates[0]?.push(signup);
  }

  return parties.filter((party) => party.length > 0);
}

type EventPartyAssignment = {
  state: "active" | "waiting";
  partyNumber: number | null;
};

function assignEventParties(
  signups: Array<Pick<PortalEventSignup, "character_id" | "role_preference" | "created_at" | "character_name">>,
  strategy: string,
  partySize: number,
  standardPartyRolesRequired = true
) {
  const safePartySize = Math.max(1, Math.min(24, Math.floor(partySize || 8)));
  const ordered = [...signups].sort((a, b) => {
    const createdDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return createdDifference || a.character_name.localeCompare(b.character_name) || a.character_id - b.character_id;
  });
  const assignments = new Map<number, EventPartyAssignment>();

  if (strategy !== "split") {
    ordered.forEach((signup, index) => assignments.set(signup.character_id, {
      state: index < safePartySize ? "active" : "waiting",
      partyNumber: index < safePartySize ? 1 : null
    }));
    return assignments;
  }

  const teamCount = Math.max(1, Math.ceil(ordered.length / safePartySize));
  const baseSize = Math.floor(ordered.length / teamCount);
  const extra = ordered.length % teamCount;
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    number: index + 1,
    capacity: baseSize + (index < extra ? 1 : 0),
    members: [] as typeof ordered
  }));
  const rolePriority: Record<string, number> = { tank: 0, healer: 1, flexible: 2, melee_dps: 3, ranged_dps: 3, caster: 3 };
  const partyOrdered = standardPartyRolesRequired
    ? [...ordered].sort((a, b) =>
        (rolePriority[a.role_preference] ?? 4) - (rolePriority[b.role_preference] ?? 4) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : ordered;

  for (const signup of partyOrdered) {
    const available = teams.filter((team) => team.members.length < team.capacity);
    available.sort((a, b) => {
      const roleDifference = standardPartyRolesRequired
        ? a.members.filter((member) => member.role_preference === signup.role_preference).length -
          b.members.filter((member) => member.role_preference === signup.role_preference).length
        : 0;
      return roleDifference || a.members.length - b.members.length || a.number - b.number;
    });
    const team = available[0];
    if (!team) continue;
    team.members.push(signup);
    assignments.set(signup.character_id, { state: "active", partyNumber: team.number });
  }

  return assignments;
}

function getPartyRoleNeeds(signups: PortalEventSignup[], partySize: number) {
  const safePartySize = Math.max(1, partySize || 8);
  const supportTarget = safePartySize <= 3 ? 0 : Math.max(1, Math.floor(safePartySize / 4));
  const targets = { tank: supportTarget, healer: supportTarget, dps: Math.max(0, safePartySize - supportTarget * 2) };
  const counts = {
    tank: signups.filter((signup) => signup.role_preference === "tank").length,
    healer: signups.filter((signup) => signup.role_preference === "healer").length,
    dps: signups.filter((signup) => ["melee_dps", "ranged_dps", "caster"].includes(signup.role_preference)).length
  };
  let flexible = signups.filter((signup) => signup.role_preference === "flexible").length;
  const gaps = { tank: Math.max(0, targets.tank - counts.tank), healer: Math.max(0, targets.healer - counts.healer), dps: Math.max(0, targets.dps - counts.dps) };
  for (const role of ["tank", "healer", "dps"] as const) {
    const covered = Math.min(flexible, gaps[role]);
    gaps[role] -= covered;
    flexible -= covered;
  }
  return [
    gaps.tank ? `${gaps.tank} tank` : "",
    gaps.healer ? `${gaps.healer} healer` : "",
    gaps.dps ? `${gaps.dps} DPS` : ""
  ].filter(Boolean).join(", ") || "Covered";
}

const EVENT_CHECK_IN_LEAD_MINUTES = 60;
const DEFAULT_EVENT_DURATION_HOURS = 6;
const CHECKED_IN_ATTENDANCE_STATUSES = new Set(["present", "late"]);

const MOUNT_EXPANSION_LEVEL_CAPS: Record<string, number> = {
  "A Realm Reborn": 50,
  Heavensward: 60,
  Stormblood: 70,
  Shadowbringers: 80,
  Endwalker: 90,
  Dawntrail: 100
};

function getMountExpansionFilterLabel(expansion: string) {
  const levelCap = MOUNT_EXPANSION_LEVEL_CAPS[expansion];
  return levelCap ? `${expansion} - ${levelCap}` : expansion;
}

function getEventAttendanceWindow(event: Pick<PortalDiscordEvent, "event_starts_at" | "event_ends_at">) {
  const startsAt = new Date(event.event_starts_at).getTime();
  const endsAt = event.event_ends_at
    ? new Date(event.event_ends_at).getTime()
    : startsAt + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000;
  return {
    startsAt,
    opensAt: startsAt - EVENT_CHECK_IN_LEAD_MINUTES * 60 * 1000,
    endsAt
  };
}

function isEventCheckInOpen(event: Pick<PortalDiscordEvent, "event_starts_at" | "event_ends_at" | "status" | "check_in_required">) {
  if (!event.check_in_required) return false;
  const now = Date.now();
  const window = getEventAttendanceWindow(event);
  return event.status === "planned" && now >= window.opensAt && now <= window.endsAt;
}

function getAttendanceLabel(status: string) {
  const labels: Record<string, string> = {
    not_checked_in: "Not checked in",
    present: "Present",
    late: "Late",
    left: "Left",
    no_show: "No-show"
  };
  return labels[status] || "Not checked in";
}

async function rebalanceEventRoster(client: Client, eventId: number) {
  const eventResult = await client.query(
    `select party_strategy, party_size, standard_party_roles_required, check_in_required, event_starts_at
     from portal_discord_events where id = $1 for update;`,
    [eventId]
  );
  if (eventResult.rows.length === 0) return;
  const event = eventResult.rows[0];
  const attendanceRequired = event.check_in_required === true &&
    new Date(event.event_starts_at).getTime() <= Date.now();
  const signupResult = await client.query(
    `select s.character_id::int, s.role_preference, s.created_at, c.character_name
     from portal_discord_event_signups s
     join portal_characters c on c.id = s.character_id
     where s.event_id = $1 and s.signup_status = 'going' and s.roster_state <> 'completed'
       and ($2::boolean = false or s.attendance_status in ('present', 'late'))
     order by s.created_at asc, s.character_id asc;`,
    [eventId, attendanceRequired]
  );
  const assignments = assignEventParties(
    signupResult.rows.map((row) => ({
      character_id: Number(row.character_id),
      role_preference: String(row.role_preference),
      created_at: row.created_at,
      character_name: String(row.character_name)
    })),
    String(event.party_strategy || "rotation"),
    Number(event.party_size || 8),
    event.standard_party_roles_required !== false
  );

  await client.query(
    `update portal_discord_event_signups
     set roster_state = 'waiting', party_number = null, updated_at = now()
     where event_id = $1 and roster_state <> 'completed';`,
    [eventId]
  );
  for (const [characterId, assignment] of assignments) {
    await client.query(
      `update portal_discord_event_signups
       set roster_state = $3, party_number = $4, updated_at = now()
       where event_id = $1 and character_id = $2 and roster_state <> 'completed';`,
      [eventId, characterId, assignment.state, assignment.partyNumber]
    );
  }
}

async function queueDiscordEventRefresh(client: Client, eventId: number, requestedBy: string) {
  await client.query(
    `insert into portal_discord_action_queue (
       discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at
     ) values ($1, 'refresh_event_roster', $2::jsonb, 'pending', $3, now(), now())
     on conflict (discord_user_id, action_type) where status = 'pending'
     do update set action_payload = excluded.action_payload,
                   requested_by = excluded.requested_by,
                   requested_at = now(),
                   updated_at = now();`,
    [`__event_${eventId}__`, JSON.stringify({ eventId }), requestedBy]
  );
}
function getEventEditDatePart(value: string, timeZone = portalDisplayTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getEventEditTimePart(value: string, timeZone = portalDisplayTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  const hour = part("hour") === "24" ? "00" : part("hour");
  return `${hour}:${part("minute")}`;
}
function normalizeScheduledPostDateInput(value: string) {
  const input = value.trim();
  const currentYear = new Date().getFullYear();

  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    return {
      year,
      month,
      day
    };
  }

  const slashMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);

  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const rawYear = slashMatch[3];

    const year = rawYear
      ? rawYear.length === 2
        ? Number(`20${rawYear}`)
        : Number(rawYear)
      : currentYear;

    return {
      year,
      month,
      day
    };
  }

  return null;
}

const portalTimeZone = "America/Chicago";

const memberEventTimeZoneOptions = [
  ["America/St_Johns", "Newfoundland Time"],
  ["America/Halifax", "Atlantic Time"],
  ["America/New_York", "Eastern Time"],
  ["America/Chicago", "Central Time"],
  ["America/Denver", "Mountain Time"],
  ["America/Phoenix", "Arizona Time"],
  ["America/Los_Angeles", "Pacific Time"],
  ["America/Anchorage", "Alaska Time"],
  ["Pacific/Honolulu", "Hawaii Time"],
  ["UTC", "UTC"],
  ["Europe/London", "United Kingdom"],
  ["Europe/Paris", "Central European Time"],
  ["Europe/Berlin", "Germany"],
  ["Africa/Johannesburg", "South Africa"],
  ["Asia/Dubai", "Gulf Time"],
  ["Asia/Kolkata", "India Time"],
  ["Asia/Bangkok", "Indochina Time"],
  ["Asia/Singapore", "Singapore Time"],
  ["Asia/Shanghai", "China Time"],
  ["Asia/Tokyo", "Japan Time"],
  ["Asia/Seoul", "Korea Time"],
  ["Australia/Sydney", "Sydney Time"],
  ["Australia/Brisbane", "Brisbane Time"],
  ["Australia/Perth", "Perth Time"],
  ["Pacific/Auckland", "New Zealand Time"]
] as const;

function isSupportedMemberEventTimeZone(value: string) {
  return memberEventTimeZoneOptions.some(([timeZone]) => timeZone === value);
}

function getMemberEventTimeZoneLabel(value: string) {
  return memberEventTimeZoneOptions.find(([timeZone]) => timeZone === value)?.[1] || value;
}

function getDateTimePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDateTimePartsInTimeZone(date, timeZone);

  const dateAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return dateAsUtc - date.getTime();
}

function makeDateInPortalTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = portalTimeZone
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstDate = new Date(utcGuess.getTime() - firstOffset);

  const secondOffset = getTimeZoneOffsetMs(firstDate, timeZone);

  if (secondOffset !== firstOffset) {
    return new Date(utcGuess.getTime() - secondOffset);
  }

  return firstDate;
}

function buildScheduledPostDateTime(dateInput: string, timeInput: string, timeZone = portalTimeZone) {
  const dateParts = normalizeScheduledPostDateInput(dateInput);
  const timeMatch = timeInput.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!dateParts || !timeMatch) {
    throw new Error("Use MM/DD, MM/DD/YYYY, or YYYY-MM-DD for the date and HH:MM for the time.");
  }

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    dateParts.year < 2020 ||
    dateParts.year > 2100 ||
    dateParts.month < 1 ||
    dateParts.month > 12 ||
    dateParts.day < 1 ||
    dateParts.day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("The scheduled post date/time is outside the allowed range.");
  }

  const scheduledFor = makeDateInPortalTimeZone(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    hour,
    minute,
    timeZone
  );

  const resolvedParts = getDateTimePartsInTimeZone(scheduledFor, timeZone);

  if (
    resolvedParts.year !== dateParts.year ||
    resolvedParts.month !== dateParts.month ||
    resolvedParts.day !== dateParts.day ||
    resolvedParts.hour !== hour ||
    resolvedParts.minute !== minute
  ) {
    throw new Error("The scheduled post date/time is invalid.");
  }

  if (scheduledFor.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new Error("Scheduled post time must be now or in the future.");
  }

  return scheduledFor;
}

function getDutyNameFromMountSource(sourceName: string | null) {
  if (!sourceName) return "";

  return sourceName
    .trim()
    .replace(
      /^(trial|raid|dungeon|alliance raid|alliance|ultimate|criterion|variant|source)\s*:\s*/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeDutyLookupName(value: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

// -------------------------
// SUBSECTION 03C: Database client helper
// -------------------------

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  return client;
}

// =========================
// SECTION 04: Database Schema
// =========================

// -------------------------
// SUBSECTION 04A: Portal settings table
// -------------------------

async function ensureSettingsTable(client: Client) {
  await client.query(`
    create table if not exists portal_settings (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    );
  `);

  const defaults = [
    ["discordInviteUrl", defaultSettings.discordInviteUrl],
    ["discordInvitePublic", String(defaultSettings.discordInvitePublic)],
    ["raidProgressionText", defaultSettings.raidProgressionText],
    ["raidScheduleText", defaultSettings.raidScheduleText],
    ["raidExpectationsText", defaultSettings.raidExpectationsText],
    ["raidRecruitmentText", defaultSettings.raidRecruitmentText],
    ["lodestoneUrl", defaultSettings.lodestoneUrl],
    ["recruitmentLodestoneUrl", defaultSettings.recruitmentLodestoneUrl],
    ["directDiscordContactUrl", defaultSettings.directDiscordContactUrl],
    ["welcomeText", defaultSettings.welcomeText],
    ["announcementText", defaultSettings.announcementText],
    ["fcAboutText", defaultSettings.fcAboutText],
    ["fcActivitiesText", defaultSettings.fcActivitiesText],
    ["fcScheduleText", defaultSettings.fcScheduleText],
    ["fcRecruitmentText", defaultSettings.fcRecruitmentText],
    ["fcHouseName", defaultSettings.fcHouseName],
    ["fcHouseLocation", defaultSettings.fcHouseLocation],
    ["fcHouseDescription", defaultSettings.fcHouseDescription],
    ["communityLinkOneLabel", defaultSettings.communityLinkOneLabel],
    ["communityLinkOneUrl", defaultSettings.communityLinkOneUrl],
    ["communityLinkTwoLabel", defaultSettings.communityLinkTwoLabel],
    ["communityLinkTwoUrl", defaultSettings.communityLinkTwoUrl]
  ];

  for (const [key, value] of defaults) {
    await client.query(
      `
        insert into portal_settings (key, value)
        values ($1, $2)
        on conflict (key) do nothing;
      `,
      [key, value]
    );
  }
  await syncGeneratedDefault(client, "fcHouseLocation", defaultWorld, "Faerie");
  await syncGeneratedDefault(client, "lodestoneUrl", defaultSettings.lodestoneUrl, "");
  for (const key of ["announcementText", "fcAboutText", "fcRecruitmentText", "fcHouseName"] as const) {
    await syncGeneratedDefault(client, key, defaultSettings[key],
      defaultSettings[key].replaceAll(installationPortalName, "Free Company Portal"));
  }
}

// -------------------------
// SUBSECTION 04B: Role table
// -------------------------

async function ensureRolesTable(client: Client) {
  await client.query(`
    create table if not exists portal_roles (
      name text primary key,
      sort_order integer not null default 100,
      updated_at timestamptz not null default now()
    );
  `);

  for (const role of defaultRoles) {
    await client.query(
      `
        insert into portal_roles (name, sort_order)
        values ($1, $2)
        on conflict (name) do nothing;
      `,
      [role.name, role.sort_order]
    );
  }
}

// -------------------------
// SUBSECTION 04C: Character table
// -------------------------

async function ensureCharactersTable(client: Client) {
  await client.query(`
    create table if not exists portal_characters (
      id bigserial primary key,
      display_name text not null,
      character_name text not null,
      world text not null,
      lodestone_character_id text,
      ffxiv_collect_character_id text,
      authentik_email text,
      portrait_url text,
      avatar_url text,
      portrait_synced_at timestamptz,
      role text not null default 'Member',
      fc_rank_name text,
      fc_rank_changed_at timestamptz,
      notes text,
      active boolean not null default true,
      mount_win_notifications_enabled boolean not null default true,
      fc_membership_status text not null default 'unknown',
      sync_status text not null default 'pending',
      last_fc_check_at timestamptz,
      last_mount_sync_at timestamptz,
      last_seen_in_fc_at timestamptz,
      first_seen_in_fc_at timestamptz,
      join_date_override date,
      join_date_source text not null default 'unknown',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    alter table portal_characters
      add column if not exists ffxiv_collect_character_id text,
      add column if not exists fc_rank_name text,
      add column if not exists fc_rank_changed_at timestamptz,
      add column if not exists mount_win_notifications_enabled boolean not null default true,
      add column if not exists fc_membership_status text not null default 'unknown',
      add column if not exists sync_status text not null default 'pending',
      add column if not exists last_fc_check_at timestamptz,
      add column if not exists last_mount_sync_at timestamptz,
      add column if not exists last_seen_in_fc_at timestamptz,
      add column if not exists first_seen_in_fc_at timestamptz,
      add column if not exists join_date_override date,
      add column if not exists join_date_source text not null default 'unknown',
      add column if not exists portrait_url text,
      add column if not exists avatar_url text,
      add column if not exists portrait_synced_at timestamptz;
  `);

  await client.query(`
    create table if not exists portal_character_fc_rank_history (
      id bigserial primary key,
      character_id bigint not null references portal_characters(id) on delete cascade,
      old_rank_name text not null,
      new_rank_name text not null,
      old_rank_started_at timestamptz,
      detected_at timestamptz not null default now()
    );

    create index if not exists portal_character_fc_rank_history_character_idx
    on portal_character_fc_rank_history (character_id, detected_at desc);
  `);

  await client.query(`
    update portal_characters
    set
      first_seen_in_fc_at = coalesce(first_seen_in_fc_at, created_at, last_seen_in_fc_at, now()),
      join_date_source = case
        when join_date_override is not null then 'manual'
        when join_date_source is null or join_date_source = 'unknown' then 'first_seen'
        else join_date_source
      end
    where fc_membership_status not in ('retention_expired', 'privacy_opt_out')
      and (first_seen_in_fc_at is null
       or join_date_source is null
       or join_date_source = 'unknown');
  `);
}

// -------------------------
// SUBSECTION 04D: Discord-to-character links
// -------------------------

async function ensureDiscordLinksTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_links (
      discord_user_id text primary key,
      discord_username text,
      discord_global_name text,
      discord_nickname text,
      discord_display_name text,
      character_id bigint references portal_characters(id) on delete set null,
      match_source text not null default 'unknown',
      matched_at timestamptz,
      last_seen_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      privacy_mode text not null default 'full'
    );

    alter table portal_discord_links
      add column if not exists discord_username text,
      add column if not exists discord_global_name text,
      add column if not exists discord_nickname text,
      add column if not exists discord_display_name text,
      add column if not exists character_id bigint references portal_characters(id) on delete set null,
      add column if not exists match_source text not null default 'unknown',
      add column if not exists matched_at timestamptz,
      add column if not exists last_seen_at timestamptz not null default now(),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists privacy_mode text not null default 'full';
  `);

  await client.query(`
    create or replace function portal_reject_duplicate_character_link()
    returns trigger
    language plpgsql
    as $$
    begin
      if new.character_id is null then return new; end if;
      perform pg_advisory_xact_lock(new.character_id::bigint);
      if exists (
        select 1 from portal_discord_links existing_link
        where existing_link.character_id = new.character_id
          and existing_link.discord_user_id <> new.discord_user_id
      ) then
        raise exception 'Character % is already linked to another Discord account.', new.character_id
          using errcode = '23505', constraint = 'portal_discord_links_character_owner';
      end if;
      if to_regclass('public.portal_alt_character_links') is not null and exists (
        select 1 from portal_alt_character_links existing_alt
        where existing_alt.character_id = new.character_id
          and existing_alt.active = true
          and existing_alt.discord_user_id <> new.discord_user_id
      ) then
        raise exception 'Character % is already linked as another Discord account''s additional character.', new.character_id
          using errcode = '23505', constraint = 'portal_character_cross_owner';
      end if;
      if to_regclass('public.portal_alt_character_links') is not null then
        update portal_alt_character_links
        set active = false, is_primary = false, updated_at = now()
        where character_id = new.character_id
          and discord_user_id = new.discord_user_id
          and active = true;
      end if;
      return new;
    end;
    $$;

    drop trigger if exists portal_discord_links_one_owner on portal_discord_links;
    create trigger portal_discord_links_one_owner
      before insert or update of character_id on portal_discord_links
      for each row execute function portal_reject_duplicate_character_link();

    do $$
    begin
      if not exists (
        select character_id from portal_discord_links
        where character_id is not null
        group by character_id having count(*) > 1
      ) then
        create unique index if not exists portal_discord_links_one_character
          on portal_discord_links(character_id) where character_id is not null;
      end if;
    end;
    $$;
  `);
}

// -------------------------
// SUBSECTION 04E: Mount tracker tables
// -------------------------

async function ensureMountSyncTables(client: Client) {
  await client.query(`
    create table if not exists portal_mount_sets (
      id bigserial primary key,
      name text not null unique,
      expansion text not null,
      sort_order integer not null default 100,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create table if not exists portal_mounts (
      id bigserial primary key,
      mount_name text not null,
      source_name text,
      acquisition_data jsonb not null default '[]'::jsonb,
      ffxiv_collect_mount_id text,
      patch text,
      icon_url text,
      image_url text,
      owned_percent text,
      mount_set_id bigint references portal_mount_sets(id) on delete set null,
      sort_order integer not null default 100,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (mount_name)
    );
  `);

  await client.query(`
    alter table portal_mounts
      add column if not exists description text,
      add column if not exists acquisition_data jsonb not null default '[]'::jsonb,
      add column if not exists patch text,
      add column if not exists icon_url text,
      add column if not exists image_url text,
      add column if not exists owned_percent text,
      add column if not exists mount_category text not null default 'Other',
      add column if not exists farm_priority text not null default 'optional',
      add column if not exists manual_override boolean not null default false;
  `);

  await client.query(`
    create table if not exists portal_character_mounts (
      character_id bigint not null references portal_characters(id) on delete cascade,
      mount_id bigint not null references portal_mounts(id) on delete cascade,
      owned boolean not null default false,
      ownership_source text not null default 'unknown',
      obtained_at timestamptz,
      last_checked_at timestamptz,
      updated_at timestamptz not null default now(),
      primary key (character_id, mount_id)
    );
  `);

  await client.query(`alter table portal_mounts add column if not exists marketboard_item_id bigint, add column if not exists marketboard_item_name text, add column if not exists marketboard_eligible boolean not null default false, add column if not exists marketboard_mapping_source text;`);
  await client.query(`create table if not exists portal_marketboard_item_prices (item_id bigint not null, world_name text not null, data_center_name text, min_price bigint, median_price bigint, average_sale_price numeric, daily_sale_velocity numeric, updated_at timestamptz not null default now(), primary key (item_id, world_name));`);
  await client.query(`create table if not exists portal_minions (id bigserial primary key, minion_name text not null unique, source_name text, description text, acquisition_data jsonb not null default '[]'::jsonb, ffxiv_collect_minion_id text, patch text, icon_url text, image_url text, marketboard_item_id bigint, marketboard_item_name text, marketboard_eligible boolean not null default false, updated_at timestamptz not null default now());`);
  await client.query(`alter table portal_minions add column if not exists description text, add column if not exists acquisition_data jsonb not null default '[]'::jsonb, add column if not exists marketboard_item_id bigint, add column if not exists marketboard_item_name text, add column if not exists marketboard_eligible boolean not null default false;`);
  await client.query(`create table if not exists portal_marketboard_minion_prices (item_id bigint not null, world_name text not null, data_center_name text, min_price bigint, updated_at timestamptz not null default now(), primary key (item_id, world_name));`);
  await client.query(`
    create table if not exists portal_character_minions (
      character_id bigint not null references portal_characters(id) on delete cascade,
      minion_id bigint not null references portal_minions(id) on delete cascade,
      owned boolean not null default false,
      ownership_source text not null default 'unknown',
      obtained_at timestamptz,
      last_checked_at timestamptz,
      updated_at timestamptz not null default now(),
      primary key (character_id, minion_id)
    );
  `);
  await client.query(`
    alter table portal_characters
      add column if not exists minion_ownership_initialized_at timestamptz,
      add column if not exists minion_ownership_source text,
      add column if not exists last_minion_sync_at timestamptz,
      add column if not exists last_minion_sync_count integer,
      add column if not exists last_minion_sync_result text,
      add column if not exists minion_sync_status text not null default 'pending';
  `);
  await client.query(`
    create table if not exists portal_mount_acquisitions (
      id bigserial primary key,
      character_id bigint not null,
      mount_id bigint not null,
      character_name text not null,
      mount_name text not null,
      detected_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      unique(character_id, mount_id)
    );
  `);

  await client.query(`
    alter table portal_mount_acquisitions
      add column if not exists discord_sent_at timestamptz,
      add column if not exists discord_error text,
      add column if not exists is_test boolean not null default false;
  `);

  await client.query(`
    create or replace function portal_record_mount_acquisition()
    returns trigger as $$
    begin
      if old.owned = false
        and new.owned = true
        and coalesce(current_setting('portal.suppress_mount_acquisition', true), '') <> 'true' then
        insert into portal_mount_acquisitions (
          character_id,
          mount_id,
          character_name,
          mount_name,
          detected_at
        )
        select
          new.character_id,
          new.mount_id,
          coalesce(c.display_name, c.character_name, 'Unknown Character'),
          coalesce(m.mount_name, 'Unknown Mount'),
          now()
        from portal_characters c
        join portal_mounts m on m.id = new.mount_id
        where c.id = new.character_id
          and m.active = true
        on conflict (character_id, mount_id) do nothing;
      end if;

      return new;
    end;
    $$ language plpgsql;
  `);

  await client.query(`
    drop trigger if exists portal_mount_acquisition_update on portal_character_mounts;

    create trigger portal_mount_acquisition_update
    after update of owned on portal_character_mounts
    for each row
    when (old.owned is distinct from new.owned)
    execute function portal_record_mount_acquisition();
  `);

  await client.query(`
    create table if not exists portal_sync_runs (
      id bigserial primary key,
      sync_type text not null,
      status text not null,
      message text,
      started_at timestamptz not null default now(),
      finished_at timestamptz
    );
  `);

  const defaultMountSets = [
    ["ARR Extreme Trial Mounts", "A Realm Reborn", 10],
    ["Heavensward Extreme Trial Mounts", "Heavensward", 20],
    ["Stormblood Extreme Trial Mounts", "Stormblood", 30],
    ["Shadowbringers Extreme Trial Mounts", "Shadowbringers", 40],
    ["Endwalker Extreme Trial Mounts", "Endwalker", 50],
    ["Dawntrail Extreme Trial Mounts", "Dawntrail", 60],
    ["Variant / Criterion Dungeon Mounts", "Variant / Criterion", 65],
    ["Savage / Raid Mounts", "Raid", 70],
    ["Other Priority Mounts", "Other", 80]
  ];

  for (const [name, expansion, sortOrder] of defaultMountSets) {
    await client.query(
      `
        insert into portal_mount_sets (name, expansion, sort_order)
        values ($1, $2, $3)
        on conflict (name)
        do update set
          expansion = excluded.expansion,
          sort_order = excluded.sort_order,
          updated_at = now();
      `,
      [name, expansion, sortOrder]
    );
  }
}

// -------------------------
// SUBSECTION 04E: Discord bot settings table
// -------------------------

async function ensureDiscordBotSettingsTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_bot_settings (
      id integer primary key default 1,
      guild_id text not null default '',
      verified_role_id text not null default '',
      unverified_role_id text not null default '',
      temp_access_role_id text not null default '',
      temporary_guest_enabled boolean,
      onboarding_selection_minutes integer not null default 30,
      temp_guest_hours integer not null default 6,
      welcome_channel_id text not null default '',
      free_company_chat_channel_id text not null default '',
      welcome_engagement_enabled boolean not null default false,
      welcome_wave_sticker_ids text not null default '',
      officer_log_channel_id text not null default '',
      event_channel_id text not null default '',
      raid_channel_id text not null default '',
      mount_farm_channel_id text not null default '',
      mount_win_channel_id text not null default '',
      mount_win_announcements_enabled boolean not null default true,
      anime_event_scheduling_enabled boolean,
      crafting_channel_id text not null default '',
      treasure_map_channel_id text not null default '',
      treasure_map_auto_enabled boolean not null default false,
      roster_review_channel_id text not null default '',
      test_channel_id text not null default '',
      member_rename_notification_channel_id text not null default '',
      gaming_setups_channel_id text not null default '',
      pets_gallery_channel_id text not null default '',
      glamours_gallery_channel_id text not null default '',
      artwork_gallery_channel_id text not null default '',
      giveaway_channel_id text not null default '',
      contestants_channel_id text not null default '',
      fashion_report_channel_id text not null default '',
      fashion_report_enabled boolean not null default false,
      anime_ranking_channel_id text not null default '',
      anime_ranking_enabled boolean not null default false,
      anime_ranking_thread_enabled boolean not null default true,
      lodestone_news_channel_id text not null default '',
      lodestone_news_enabled boolean not null default false,
      notification_window_enabled boolean not null default false,
      notification_window_start_time text not null default '08:00',
      notification_window_end_time text not null default '22:00',
      rename_notifications_discord_members_enabled boolean not null default true,
      rename_notifications_non_discord_members_enabled boolean not null default true,
      auto_rename_enabled boolean not null default true,
      auto_role_enabled boolean not null default true,
      startup_member_sync_enabled boolean not null default false,
      log_unmatched_attempts boolean not null default true,
      auto_roster_scan_enabled boolean not null default false,
      roster_scan_interval_hours integer not null default 24,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint portal_discord_bot_settings_singleton check (id = 1)
    );
  `);

  await client.query(`
    alter table portal_discord_bot_settings
      add column if not exists guild_id text not null default '',
      add column if not exists verified_role_id text not null default '',
      add column if not exists unverified_role_id text not null default '',
      add column if not exists temp_access_role_id text not null default '',
      add column if not exists temporary_guest_enabled boolean,
      add column if not exists onboarding_selection_minutes integer not null default 30,
      add column if not exists temp_guest_hours integer not null default 6,
      add column if not exists welcome_channel_id text not null default '',
      add column if not exists free_company_chat_channel_id text not null default '',
      add column if not exists welcome_engagement_enabled boolean not null default false,
      add column if not exists welcome_wave_sticker_ids text not null default '',
      add column if not exists officer_log_channel_id text not null default '',
      add column if not exists event_channel_id text not null default '',
      add column if not exists raid_channel_id text not null default '',
      add column if not exists mount_farm_channel_id text not null default '',
      add column if not exists mount_win_channel_id text not null default '',
      add column if not exists mount_win_announcements_enabled boolean not null default true,
      add column if not exists anime_event_scheduling_enabled boolean,
      add column if not exists crafting_channel_id text not null default '',
      add column if not exists treasure_map_channel_id text not null default '',
      add column if not exists treasure_map_auto_enabled boolean not null default false,
      add column if not exists roster_review_channel_id text not null default '',
      add column if not exists test_channel_id text not null default '',
      add column if not exists member_rename_notification_channel_id text not null default '',
      add column if not exists gaming_setups_channel_id text not null default '',
      add column if not exists pets_gallery_channel_id text not null default '',
      add column if not exists glamours_gallery_channel_id text not null default '',
      add column if not exists artwork_gallery_channel_id text not null default '',
      add column if not exists giveaway_channel_id text not null default '',
      add column if not exists contestants_channel_id text not null default '',
      add column if not exists fashion_report_channel_id text not null default '',
      add column if not exists fashion_report_enabled boolean not null default false,
      add column if not exists anime_ranking_channel_id text not null default '',
      add column if not exists anime_ranking_enabled boolean not null default false,
      add column if not exists anime_ranking_thread_enabled boolean not null default true,
      add column if not exists lodestone_news_channel_id text not null default '',
      add column if not exists lodestone_news_enabled boolean not null default false,
      add column if not exists notification_window_enabled boolean not null default false,
      add column if not exists notification_window_start_time text not null default '08:00',
      add column if not exists notification_window_end_time text not null default '22:00',
      add column if not exists rename_notifications_discord_members_enabled boolean not null default true,
      add column if not exists rename_notifications_non_discord_members_enabled boolean not null default true,
      add column if not exists auto_rename_enabled boolean not null default true,
      add column if not exists auto_role_enabled boolean not null default true,
      add column if not exists startup_member_sync_enabled boolean not null default false,
      add column if not exists log_unmatched_attempts boolean not null default true,
      add column if not exists auto_roster_scan_enabled boolean not null default false,
      add column if not exists roster_scan_interval_hours integer not null default 24,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);

  await client.query(`
    update portal_discord_bot_settings
    set event_channel_id = case
          when raid_channel_id <> '' then raid_channel_id
          when event_channel_id = '' and mount_farm_channel_id <> '' then mount_farm_channel_id
          else event_channel_id
        end,
        raid_channel_id = '',
        mount_farm_channel_id = '',
        updated_at = now()
    where raid_channel_id <> '' or mount_farm_channel_id <> '';
  `);

  await client.query(`
    insert into portal_discord_bot_settings (id, welcome_engagement_enabled, welcome_wave_sticker_ids)
    values (1, $1, $2)
    on conflict (id) do nothing;
  `, [
    ["1", "true", "yes", "on"].includes(String(process.env.DISCORD_WELCOME_ENGAGEMENT_ENABLED || "false").toLowerCase()),
    process.env.DISCORD_WELCOME_WAVE_STICKER_IDS ?? defaultWelcomeWaveStickerIds
  ]);

  await client.query(`alter table portal_discord_bot_settings add column if not exists alt_character_claims_enabled boolean not null default false, add column if not exists alt_character_default_limit integer not null default 1, add column if not exists alt_character_verification_mode text not null default 'code_or_officer', add column if not exists alt_character_code_expiry_minutes integer not null default 60;`);
  await client.query(`create table if not exists portal_alt_character_limits(discord_user_id text primary key,max_additional_characters integer not null check(max_additional_characters between 0 and 32),updated_by_discord_user_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await client.query(`create table if not exists portal_alt_character_links(id bigserial primary key,discord_user_id text not null,character_id bigint not null references portal_characters(id) on delete cascade,is_primary boolean not null default false,verification_method text not null,verified_by_discord_user_id text,verified_at timestamptz not null default now(),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(discord_user_id,character_id));`);
  await client.query(`create unique index if not exists portal_alt_character_one_owner_idx on portal_alt_character_links(character_id) where active=true;`);
  await client.query(`create or replace function portal_reject_duplicate_alt_character_link() returns trigger language plpgsql as $$ begin if new.active=false then return new; end if; perform pg_advisory_xact_lock(new.character_id::bigint); if exists(select 1 from portal_discord_links dl where dl.character_id=new.character_id) then raise exception 'Character % is already a Free Company membership anchor and cannot also be an additional character.',new.character_id using errcode='23505',constraint='portal_character_cross_owner'; end if; return new; end; $$; drop trigger if exists portal_alt_character_links_cross_owner on portal_alt_character_links; create trigger portal_alt_character_links_cross_owner before insert or update of character_id,discord_user_id,active on portal_alt_character_links for each row execute function portal_reject_duplicate_alt_character_link();`);
  await client.query(`update portal_alt_character_links acl set active=false,is_primary=false,updated_at=now() where acl.active=true and exists(select 1 from portal_discord_links dl where dl.character_id=acl.character_id);`);
  await client.query(`update portal_characters c set role='Alt' where exists(select 1 from portal_alt_character_links acl where acl.character_id=c.id and acl.active=true) and c.role<>'Alt';`);
  await client.query(`create or replace view portal_tracked_characters as select c.id from portal_characters c where c.active=true and (c.fc_membership_status='current' or exists(select 1 from portal_alt_character_links acl join portal_discord_links dl on dl.discord_user_id=acl.discord_user_id join portal_characters anchor on anchor.id=dl.character_id where acl.character_id=c.id and acl.active=true and anchor.active=true and anchor.fc_membership_status='current'));`);
  await client.query(`create table if not exists portal_alt_character_claims(id bigserial primary key,discord_user_id text not null,lodestone_character_id text not null,character_name text not null,world text not null,data_center text not null,status text not null default 'pending',code_digest text,code_expires_at timestamptz,officer_message_id text,officer_channel_id text,resolution_method text,resolved_by_discord_user_id text,resolved_at timestamptz,rejection_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await client.query(`create unique index if not exists portal_alt_character_pending_idx on portal_alt_character_claims(discord_user_id,lodestone_character_id) where status in ('pending','code_required');`);
}

// -------------------------
// SUBSECTION 04F: Discord roster review decisions table
// -------------------------

async function ensureDiscordRosterReviewDecisionsTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_roster_review_decisions (
      discord_user_id text primary key,
      decision text not null default 'review',
      note text,
      decided_by text,
      decided_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    alter table portal_discord_roster_review_decisions
      add column if not exists decision text not null default 'review',
      add column if not exists note text,
      add column if not exists decided_by text,
      add column if not exists decided_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);
}

// -------------------------
// SUBSECTION 04G: Discord action queue table
// -------------------------

async function ensureDiscordActionQueueTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_action_queue (
      id bigserial primary key,
      discord_user_id text not null,
      action_type text not null,
      action_payload jsonb not null default '{}'::jsonb,
      status text not null default 'pending',
      requested_by text,
      requested_at timestamptz not null default now(),
      picked_at timestamptz,
      completed_at timestamptz,
      result_message text,
      error_message text,
      archived_at timestamptz,
      archived_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    alter table portal_discord_action_queue
      add column if not exists discord_user_id text not null default '',
      add column if not exists action_type text not null default '',
      add column if not exists action_payload jsonb not null default '{}'::jsonb,
      add column if not exists status text not null default 'pending',
      add column if not exists requested_by text,
      add column if not exists requested_at timestamptz not null default now(),
      add column if not exists picked_at timestamptz,
      add column if not exists completed_at timestamptz,
      add column if not exists result_message text,
      add column if not exists error_message text,
      add column if not exists archived_at timestamptz,
      add column if not exists archived_by text,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);

  await client.query(`
    create unique index if not exists portal_discord_action_queue_pending_once
    on portal_discord_action_queue (discord_user_id, action_type)
    where status = 'pending';
  `);
}

// -------------------------
// SUBSECTION 04H: Discord member snapshot table
// -------------------------

async function ensureDiscordMemberSnapshotTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_member_snapshots (
      discord_user_id text primary key,
      discord_username text,
      discord_global_name text,
      discord_nickname text,
      discord_display_name text,
      is_bot boolean not null default false,
      present_in_guild boolean not null default true,
      has_verified_role boolean not null default false,
      has_unverified_role boolean not null default false,
      linked_character_id bigint,
      linked_character_name text,
      linked_world text,
      linked_fc_status text,
      linked_active boolean,
      review_status text not null default 'ok',
      review_reason text,
      last_scanned_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    alter table portal_discord_member_snapshots
      add column if not exists discord_username text,
      add column if not exists discord_global_name text,
      add column if not exists discord_nickname text,
      add column if not exists discord_display_name text,
      add column if not exists is_bot boolean not null default false,
      add column if not exists present_in_guild boolean not null default true,
      add column if not exists has_verified_role boolean not null default false,
      add column if not exists has_unverified_role boolean not null default false,
      add column if not exists linked_character_id bigint,
      add column if not exists linked_character_name text,
      add column if not exists linked_world text,
      add column if not exists linked_fc_status text,
      add column if not exists linked_active boolean,
      add column if not exists review_status text not null default 'ok',
      add column if not exists review_reason text,
      add column if not exists last_scanned_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);
}

// -------------------------
// SUBSECTION 04I: Schema orchestrator
// -------------------------

async function ensureDiscordScheduledPostsTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_scheduled_posts (
      id bigserial primary key,
      post_type text not null default 'custom',
      title text not null default '',
      message text not null default '',
      embed_image_url text,
           thumbnail_image_url text,
      target_channel_kind text not null default 'custom',
      target_channel_id text not null default '',
      scheduled_for timestamptz not null,
      status text not null default 'scheduled',
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      sent_at timestamptz,
      sent_message_id text,
      error_message text,
      cancelled_at timestamptz,
      cancelled_by text,
      event_id bigint,
      event_plan_id bigint,
      reminder_offset_minutes integer
    );
  `);

  await client.query(`
    alter table portal_discord_scheduled_posts
      add column if not exists post_type text not null default 'custom',
      add column if not exists title text not null default '',
      add column if not exists message text not null default '',
      add column if not exists embed_image_url text,
          add column if not exists thumbnail_image_url text,
      add column if not exists target_channel_kind text not null default 'custom',
      add column if not exists target_channel_id text not null default '',
      add column if not exists scheduled_for timestamptz not null default now(),
      add column if not exists status text not null default 'scheduled',
      add column if not exists created_by text,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists sent_at timestamptz,
      add column if not exists sent_message_id text,
      add column if not exists error_message text,
      add column if not exists cancelled_at timestamptz,
      add column if not exists cancelled_by text,
      add column if not exists event_id bigint,
      add column if not exists event_plan_id bigint,
      add column if not exists reminder_offset_minutes integer;
  `);

  await client.query(`
    create index if not exists portal_discord_scheduled_posts_due_idx
    on portal_discord_scheduled_posts (status, scheduled_for);
  `);

  await client.query(`
    create index if not exists portal_discord_scheduled_posts_event_idx
    on portal_discord_scheduled_posts (event_id, status, scheduled_for);
  `);
}


async function ensureCharacterRenameHistoryTable(client: Client) {
  await client.query(`
    create table if not exists portal_character_rename_history (
      id bigserial primary key,
      character_id bigint not null references portal_characters(id) on delete cascade,
      old_name text not null,
      new_name text not null,
      detected_at timestamptz not null default now(),
      notification_status text not null default 'pending',
      notification_message_id text,
      confirmation_status text not null default 'pending',
      confirmed_at timestamptz,
      confirmed_by text
    );
  `);

  await client.query(`
    create unique index if not exists portal_character_rename_history_unique
    on portal_character_rename_history (character_id, old_name, new_name);
  `);
}
async function ensureCommandDiagnosticsTable(client: Client) {
  await client.query(`
    create table if not exists portal_command_diagnostics (
      id bigserial primary key,
      reference_id text not null unique,
      command_name text not null,
      command_path text not null,
      interaction_kind text not null default 'command',
      discord_user_id text,
      discord_username text,
      discord_display_name text,
      character_id bigint,
      character_name text,
      guild_id text,
      channel_id text,
      outcome text not null check (outcome in ('success', 'failure')),
      failure_stage text,
      error_code text,
      error_message text,
      duration_ms integer not null default 0,
      bot_version text,
      created_at timestamptz not null default now()
    );
  `);
  await client.query(`alter table portal_command_diagnostics alter column discord_user_id drop not null;`);
  await client.query(`update portal_command_diagnostics set discord_user_id=null,discord_username=null,discord_display_name=null,character_id=null,character_name=null where outcome='success';`);
  await client.query(`create index if not exists portal_command_diagnostics_created_idx on portal_command_diagnostics (created_at desc);`);
  await client.query(`create index if not exists portal_command_diagnostics_user_idx on portal_command_diagnostics (discord_user_id, created_at desc);`);
  await client.query(`create table if not exists portal_command_usage_daily (usage_date date not null, command_path text not null, invocation_count integer not null default 0, primary key (usage_date, command_path));`);
  await client.query(`delete from portal_command_diagnostics where created_at < now() - interval '30 days';`);
  await client.query(`delete from portal_command_usage_daily where usage_date < current_date - 90;`);
}

async function ensurePortalAnnouncementsTable(client: Client) {
  await client.query(`
    create table if not exists portal_announcements (
      id bigserial primary key,
      title text not null,
      body text not null,
      category text not null default 'Community',
      created_by text,
      published_at timestamptz not null default now(),
      archived_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create index if not exists portal_announcements_public_idx
    on portal_announcements (published_at desc)
    where archived_at is null;
  `);
}
async function ensureFcGalleryImagesTable(client: Client) {
  await client.query(`
    create table if not exists portal_fc_gallery_images (
      id bigserial primary key,
      title text not null default 'FC Gallery Photo',
      alt_text text not null default '',
      mime_type text not null,
      image_data bytea not null,
      image_size integer not null,
      created_by text,
      archived_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create index if not exists portal_fc_gallery_images_public_idx
    on portal_fc_gallery_images (created_at desc)
    where archived_at is null;
  `);
}
async function ensureFcInfoCardsTable(client: Client) {
  await client.query(`
    create table if not exists portal_fc_info_cards (
      id bigserial primary key,
      label text not null default 'Free Company',
      title text not null,
      body text not null,
      sort_order integer not null default 100,
      archived_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create index if not exists portal_fc_info_cards_public_idx
    on portal_fc_info_cards (sort_order asc, created_at asc)
    where archived_at is null;
  `);

  await client.query("alter table portal_fc_info_cards add column if not exists generated_title text;");
  // Legacy seed cards are identifiable only while they have never been edited.
  await client.query(`update portal_fc_info_cards set generated_title = title
    where generated_title is null and label = 'Join Us' and title = 'A home on Faerie'
      and updated_at = created_at;`);
  await client.query(`update portal_fc_info_cards set title = $1, generated_title = $1
    where generated_title is not null and title = generated_title;`, [`A home on ${defaultWorld}`]);
  await client.query(`update portal_fc_info_cards set body = $1
    where label = 'Join Us' and body = $2;`, [
    defaultSettings.fcRecruitmentText,
    defaultSettings.fcRecruitmentText.replaceAll(installationPortalName, "Free Company Portal")
  ]);
  const initialized = await client.query<{ value: string }>(`select value from portal_settings where key = 'fcInfoCardsInitialized' limit 1;`);
  if (initialized.rows[0]?.value === "true") return;

  const settingRows = await client.query<{ key: string; value: string }>(`
    select key, value from portal_settings
    where key = any($1::text[]);
  `, [["fcActivitiesText", "fcScheduleText", "fcRecruitmentText"]]);
  const saved = new Map(settingRows.rows.map((row) => [row.key, row.value]));
  await client.query(
    `insert into portal_fc_info_cards (label, title, body, sort_order)
     values ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12);`,
    [
      "What We Do", "Play together", saved.get("fcActivitiesText") || defaultSettings.fcActivitiesText, 10,
      "When We Play", "Plan your next adventure", saved.get("fcScheduleText") || defaultSettings.fcScheduleText, 20,
      "Join Us", `A home on ${defaultWorld}`, saved.get("fcRecruitmentText") || defaultSettings.fcRecruitmentText, 30
    ]
  );
  await client.query(`update portal_fc_info_cards set generated_title = title
    where label = 'Join Us' and title = $1 and updated_at = created_at;`, [`A home on ${defaultWorld}`]);
  await client.query(
    `insert into portal_settings (key, value, updated_at)
     values ('fcInfoCardsInitialized', 'true', now())
     on conflict (key) do update set value = excluded.value, updated_at = now();`
  );
}
async function ensureGuideResourcesTable(client: Client) {
  await client.query(`
    create table if not exists portal_guide_resources (
      id bigserial primary key,
      category text not null default 'Resource',
      title text not null,
      body text not null,
      url text,
      sort_order integer not null default 100,
      visibility_mode text not null default 'members',
      archived_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create index if not exists portal_guide_resources_public_idx
    on portal_guide_resources (sort_order asc, created_at asc)
    where archived_at is null;
  `);

  const cleanup = await client.query<{ value: string }>(`select value from portal_settings where key = 'guidePlaceholdersRemovedV1' limit 1;`);
  if (cleanup.rows[0]?.value !== "true") {
    await client.query(
      `delete from portal_guide_resources
       where (title = 'How to RSVP' and category = 'Events')
          or (title = 'Stay connected' and category = 'Discord')
          or (title = 'Ask the FC' and category = 'Support');`
    );
    await client.query(
      `insert into portal_settings (key, value, updated_at)
       values ('guidePlaceholdersRemovedV1', 'true', now())
       on conflict (key) do update set value = excluded.value, updated_at = now();`
    );
  }
}
async function ensurePortalLinkCardsTable(client: Client) {
  await client.query(`
    create table if not exists portal_link_cards (
      id bigserial primary key,
      label text not null,
      url text not null,
      description text,
      sort_order integer not null default 100,
      image_mime_type text,
      image_data bytea,
      image_size integer,
      created_by text,
      archived_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create index if not exists portal_link_cards_public_idx
    on portal_link_cards (sort_order asc, created_at asc)
    where archived_at is null;
  `);
}
async function ensureCommunityGalleryTables(client: Client) {
  await client.query(`
    create table if not exists portal_community_gallery_posts (
      id bigserial primary key,
      category text not null check (category in ('gaming_setup', 'pet', 'glamour', 'artwork')),
      source_channel_id text not null,
      source_message_id text not null unique,
      discord_user_id text not null,
      discord_display_name text not null,
      display_name_override text,
      caption text,
      posted_at timestamptz not null,
      review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
      reviewed_by text,
      reviewed_at timestamptz,
      review_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await client.query(`
    alter table portal_community_gallery_posts
      add column if not exists display_name_override text;
  `);
  await client.query(`
    do $$
    declare constraint_name text;
    begin
      select conname into constraint_name from pg_constraint
      where conrelid = 'portal_community_gallery_posts'::regclass
        and contype = 'c' and pg_get_constraintdef(oid) like '%category%'
      limit 1;
      if constraint_name is not null then
        execute format('alter table portal_community_gallery_posts drop constraint %I', constraint_name);
      end if;
    end $$;
    alter table portal_community_gallery_posts
      add constraint portal_community_gallery_posts_category_allowed
      check (category in ('gaming_setup', 'pet', 'glamour', 'artwork'));
  `);
  await client.query(`
    create table if not exists portal_community_gallery_images (
      id bigserial primary key,
      post_id bigint not null references portal_community_gallery_posts(id) on delete cascade,
      source_attachment_id text not null,
      filename text not null,
      mime_type text not null,
      image_data bytea not null,
      image_size integer not null,
      created_at timestamptz not null default now(),
      unique(post_id, source_attachment_id)
    );
  `);
  await client.query(`
    create table if not exists portal_community_gallery_import_requests (
      category text primary key check (category in ('gaming_setup', 'pet', 'glamour')),
      requested_by text,
      requested_at timestamptz not null default now(),
      status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
      scanned_messages integer not null default 0,
      imported_posts integer not null default 0,
      completed_at timestamptz,
      error_text text
    );
  `);
  await client.query(`alter table portal_guide_resources add column if not exists visibility_mode text not null default 'members';`);
  await client.query(`
    create table if not exists portal_collection_source_warnings (
      id bigserial primary key,
      catalog_name text not null,
      source_type text not null,
      affected_count integer not null default 0,
      example_items jsonb not null default '[]'::jsonb,
      first_observed_at timestamptz not null default now(),
      last_observed_at timestamptz not null default now(),
      resolved_at timestamptz,
      unique (catalog_name, source_type)
    );
  `);
  await client.query(`
    do $$
    declare constraint_name text;
    begin
      select conname into constraint_name from pg_constraint
      where conrelid = 'portal_community_gallery_import_requests'::regclass
        and contype = 'c' and pg_get_constraintdef(oid) like '%category%'
      limit 1;
      if constraint_name is not null then
        execute format('alter table portal_community_gallery_import_requests drop constraint %I', constraint_name);
      end if;
    end $$;
    alter table portal_community_gallery_import_requests
      add constraint portal_community_gallery_import_requests_category_allowed
      check (category in ('gaming_setup', 'pet', 'glamour', 'artwork'));
  `);
  await client.query(`
    create index if not exists portal_community_gallery_posts_public_idx
    on portal_community_gallery_posts (category, posted_at desc)
    where review_status = 'approved';
  `);
}
async function ensureMemberPreferencesTable(client: Client) {
  await client.query(`
    create table if not exists portal_member_preferences (
      discord_user_id text primary key,
      artwork_public_enabled boolean not null default false,
      gaming_setup_public_enabled boolean not null default false,
      pet_public_enabled boolean not null default false,
      glamour_public_enabled boolean not null default false,
      event_reminder_mentions_enabled boolean not null default true,
      event_reminder_level text not null default 'all',
      default_event_role text not null default 'flexible',
      secondary_event_role text not null default 'none',
      event_time_zone text not null default 'America/Chicago',
      motion_effects_enabled boolean not null default true,
      motion_preference text not null default 'automatic',
      layout_density text not null default 'comfortable',
      text_scale text not null default 'standard',
      high_contrast_enabled boolean not null default false,
      data_saver_enabled boolean not null default false,
      card_flip_enabled boolean not null default true,
      time_zone_mode text not null default 'central',
      time_format text not null default '12',
      anime_language text not null default 'all',
      anime_platforms text not null default '',
      anime_default_view text not null default 'upcoming',
      hide_owned_mounts boolean not null default false,
      hide_owned_minions boolean not null default false,
      hide_owned_titles boolean not null default false,
      hide_owned_achievements boolean not null default false,
      default_mount_tab text not null default 'collection',
      default_minion_tab text not null default 'collection',
      default_minion_category text not null default '',
      default_landing_view text not null default 'home',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await client.query(`
    alter table portal_member_preferences
      add column if not exists event_reminder_mentions_enabled boolean not null default true,
      add column if not exists event_reminder_level text not null default 'all',
      add column if not exists default_event_role text not null default 'flexible',
      add column if not exists secondary_event_role text not null default 'none',
      add column if not exists event_time_zone text not null default 'America/Chicago',
      add column if not exists motion_effects_enabled boolean not null default true,
      add column if not exists motion_preference text not null default 'automatic',
      add column if not exists layout_density text not null default 'comfortable',
      add column if not exists text_scale text not null default 'standard',
      add column if not exists high_contrast_enabled boolean not null default false,
      add column if not exists data_saver_enabled boolean not null default false,
      add column if not exists card_flip_enabled boolean not null default true,
      add column if not exists time_zone_mode text not null default 'central',
      add column if not exists time_format text not null default '12',
      add column if not exists anime_language text not null default 'all',
      add column if not exists anime_platforms text not null default '',
      add column if not exists anime_default_view text not null default 'upcoming',
      add column if not exists hide_owned_mounts boolean not null default false,
      add column if not exists hide_owned_minions boolean not null default false,
      add column if not exists hide_owned_titles boolean not null default false,
      add column if not exists hide_owned_achievements boolean not null default false,
      add column if not exists default_mount_tab text not null default 'collection',
      add column if not exists default_minion_tab text not null default 'collection',
      add column if not exists default_minion_category text not null default '',
      add column if not exists default_landing_view text not null default 'home',
      add column if not exists gaming_setup_public_enabled boolean not null default false,
      add column if not exists pet_public_enabled boolean not null default false,
      add column if not exists glamour_public_enabled boolean not null default false;
  `);
}

async function ensureFcRosterAuditTables(client: Client) {
  await client.query(`
    create table if not exists portal_worker_requests (
      id bigserial primary key,
      request_type text not null,
      status text not null default 'pending',
      requested_by text,
      requested_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz,
      message text
    );
  `);
  await client.query(`
    create unique index if not exists portal_worker_requests_pending_unique
    on portal_worker_requests (request_type)
    where status = 'pending';
  `);
  await client.query(`
    create table if not exists portal_fc_roster_change_log (
      id bigserial primary key,
      scan_source text not null default 'scheduled',
      change_type text not null check (change_type in ('added', 'removed')),
      character_name text not null,
      world text not null,
      lodestone_character_id text,
      detected_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create index if not exists portal_fc_roster_change_log_detected_idx
    on portal_fc_roster_change_log (detected_at desc);
  `);
}

async function applyPortalSchemaMigrations(client: Client) {
  await client.query(`
    create table if not exists portal_fc_verification (
      id integer primary key check(id=1),fc_lodestone_id text not null,lodestone_url text not null,
      discord_guild_id text not null,world text not null,datacenter text not null,
      verification_code text not null,status text not null default 'pending' check(status in ('pending','verified')),
      verified_at timestamptz,last_checked_at timestamptz,last_error text,updated_at timestamptz not null default now()
    );
  `);
  await ensureSettingsTable(client);
  await ensurePortalAnnouncementsTable(client);
  await ensureFcGalleryImagesTable(client);
  await ensureFcInfoCardsTable(client);
  await ensureGuideResourcesTable(client);
  await ensurePortalLinkCardsTable(client);
  await ensureCommunityGalleryTables(client);
  await ensureMemberPreferencesTable(client);
  await ensureAvailabilityTables(client);
  await ensureRolesTable(client);
  await ensureCharactersTable(client);
  await ensureDiscordLinksTable(client);
  await ensureGiveawayTables(client);
  await ensurePollTables(client);
  await ensureCraftingTables(client);
  await ensureCharacterRenameHistoryTable(client);
  await ensureCommandDiagnosticsTable(client);
  await ensureFcRosterAuditTables(client);
  await ensureBackupJobsTable(client);
  await ensureMountSyncTables(client);
  await ensureAchievementCollectionTables(client);
  await ensureDiscordBotSettingsTable(client);
  await ensureDiscordRosterReviewDecisionsTable(client);
  await ensureDiscordActionQueueTable(client);
  await ensureDiscordMemberSnapshotTable(client);
  await ensureDiscordScheduledPostsTable(client);
  await ensureDiscordDutiesTable(client);
  await ensureDiscordEventTemplatesAndSeriesTables(client);
  await ensureDiscordEventsTable(client);
  await ensureEventPlanningTables(client);
  await ensureDiscordEventAuditTable(client);
  await ensureDiscordEventSignupsTable(client);
  await ensurePrivacyTables(client);
}

// Database setup is deliberately performed once per running portal instance.
// A normal page load reads many independent sections in parallel; allowing each
// of those reads to run CREATE/ALTER statements at the same time can make
// PostgreSQL report a concurrent catalog update and fail the whole page.
let portalSchemaReady: Promise<void> | null = null;

async function ensurePortalSchema(client: Client) {
  if (!portalSchemaReady) {
    const initialization = (async () => {
      // This also keeps a portal restart from racing another portal request
      // while the initial schema check is still in progress.
      await client.query("select pg_advisory_lock(91742026)");
      try {
        await applyPortalSchemaMigrations(client);
      } finally {
        await client.query("select pg_advisory_unlock(91742026)");
      }
    })();

    portalSchemaReady = initialization;
    void initialization.catch(() => {
      if (portalSchemaReady === initialization) portalSchemaReady = null;
    });
  }

  await portalSchemaReady;
}

async function ensureDiscordEventTemplatesAndSeriesTables(client: Client) {
  await client.query(`
    create table if not exists portal_discord_event_templates (
      id bigserial primary key,
      name text not null unique,
      event_type text not null default 'custom',
      title text not null default '',
      description text not null default '',
      level integer,
      duty_id bigint references portal_discord_duties(id) on delete set null,
      duty_name text,
      duty_image_url text,
      mount_id bigint references portal_mounts(id) on delete set null,
      mount_name text,
      mount_source_name text,
      embed_image_url text,
      thumbnail_image_url text,
      target_channel_kind text not null default 'event',
      target_channel_id text not null default '',
      party_strategy text not null default 'rotation',
      party_size integer not null default 8,
      standard_party_roles_required boolean not null default true,
      check_in_required boolean not null default false,
      reminder_24h_enabled boolean not null default true,
      reminder_1h_enabled boolean not null default true,
      announcement_lead_minutes integer not null default 10080,
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create table if not exists portal_discord_event_series (
      id bigserial primary key,
      template_id bigint references portal_discord_event_templates(id) on delete set null,
      series_name text not null,
      event_type text not null default 'custom',
      title text not null default '',
      description text not null default '',
      level integer,
      duty_id bigint references portal_discord_duties(id) on delete set null,
      duty_name text,
      duty_image_url text,
      mount_id bigint references portal_mounts(id) on delete set null,
      mount_name text,
      mount_source_name text,
      embed_image_url text,
      thumbnail_image_url text,
      target_channel_kind text not null default 'event',
      target_channel_id text not null default '',
      party_strategy text not null default 'rotation',
      party_size integer not null default 8,
      standard_party_roles_required boolean not null default true,
      check_in_required boolean not null default false,
      reminder_24h_enabled boolean not null default true,
      reminder_1h_enabled boolean not null default true,
      announcement_lead_minutes integer not null default 10080,
      recurrence_kind text not null default 'weekly',
      next_occurrence_at timestamptz not null,
      next_occurrence_number integer not null default 1,
      end_at timestamptz,
      occurrences_ahead integer not null default 4,
      active boolean not null default true,
      generated_count integer not null default 0,
      last_generated_at timestamptz,
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      paused_at timestamptz,
      paused_by text,
      ended_at timestamptz,
      ended_by text
    );
  `);
  await client.query(`
    alter table portal_discord_event_templates
      add column if not exists standard_party_roles_required boolean not null default true;
    alter table portal_discord_event_templates
      add column if not exists check_in_required boolean not null default false;
    alter table portal_discord_event_series
      add column if not exists standard_party_roles_required boolean not null default true;
    alter table portal_discord_event_series
      add column if not exists check_in_required boolean not null default false;
  `);
  await client.query(`
    create index if not exists portal_discord_event_series_active_next_idx
    on portal_discord_event_series (active, next_occurrence_at);
  `);
}
async function ensureDiscordEventsTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_events (
      id bigserial primary key,
      event_type text not null default 'custom',
      title text not null default '',
      description text not null default '',
      level integer,
      level_max integer,
      event_time_zone text not null default 'America/Chicago',
          duty_id bigint references portal_discord_duties(id) on delete set null,
      duty_name text,
      duty_image_url text,
      target_channel_kind text not null default 'event',
      target_channel_id text not null default '',
      event_starts_at timestamptz not null,
      event_ends_at timestamptz,
      announcement_post_at timestamptz,
      announcement_scheduled_post_id bigint references portal_discord_scheduled_posts(id) on delete set null,
      party_strategy text not null default 'rotation',
      party_size integer not null default 8,
      standard_party_roles_required boolean not null default true,
      check_in_required boolean not null default false,
      roster_locked boolean not null default false,
      check_in_opened_at timestamptz,
      attendance_started_at timestamptz,
      series_id bigint references portal_discord_event_series(id) on delete set null,
      series_occurrence_number integer,
      reminder_24h_enabled boolean not null default true,
      reminder_1h_enabled boolean not null default true,
      last_edited_at timestamptz,
      last_edited_by text,
      status text not null default 'planned',
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      cancelled_at timestamptz,
      cancelled_by text,
      expired_at timestamptz,
      archived_at timestamptz,
      archived_by text
    );
  `);

  await client.query(`
    alter table portal_discord_events
      add column if not exists event_type text not null default 'custom',
      add column if not exists title text not null default '',
      add column if not exists description text not null default '',
      add column if not exists level integer,
      add column if not exists level_max integer,
      add column if not exists event_time_zone text not null default 'America/Chicago',
           add column if not exists duty_id bigint references portal_discord_duties(id) on delete set null,
      add column if not exists duty_name text,
      add column if not exists duty_image_url text,
      add column if not exists target_channel_kind text not null default 'event',
      add column if not exists target_channel_id text not null default '',
      add column if not exists event_starts_at timestamptz not null default now(),
      add column if not exists event_ends_at timestamptz,
      add column if not exists announcement_post_at timestamptz,
      add column if not exists announcement_scheduled_post_id bigint references portal_discord_scheduled_posts(id) on delete set null,
      add column if not exists party_strategy text not null default 'rotation',
      add column if not exists party_size integer not null default 8,
      add column if not exists standard_party_roles_required boolean not null default true,
      add column if not exists check_in_required boolean not null default false,
      add column if not exists roster_locked boolean not null default false,
      add column if not exists check_in_opened_at timestamptz,
      add column if not exists attendance_started_at timestamptz,
      add column if not exists series_id bigint references portal_discord_event_series(id) on delete set null,
      add column if not exists series_occurrence_number integer,
      add column if not exists reminder_24h_enabled boolean not null default true,
      add column if not exists reminder_1h_enabled boolean not null default true,
      add column if not exists last_edited_at timestamptz,
      add column if not exists last_edited_by text,
      add column if not exists status text not null default 'planned',
      add column if not exists created_by text,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists cancelled_at timestamptz,
      add column if not exists cancelled_by text,
      add column if not exists expired_at timestamptz,
      add column if not exists archived_at timestamptz,
      add column if not exists archived_by text;
  `);

  await client.query(`
    create index if not exists portal_discord_events_status_start_idx
    on portal_discord_events (status, event_starts_at);
  `);
  await client.query(`
    create unique index if not exists portal_discord_events_series_occurrence_idx
    on portal_discord_events (series_id, event_starts_at)
    where series_id is not null;
  `);

  await client.query(`
    create table if not exists portal_discord_event_mounts (
      event_id bigint not null references portal_discord_events(id) on delete cascade,
      mount_id bigint not null references portal_mounts(id) on delete cascade,
      sort_order integer not null default 100,
      created_at timestamptz not null default now(),
      primary key (event_id, mount_id)
    );
  `);

  await client.query(`
    alter table portal_discord_event_mounts
      add column if not exists sort_order integer not null default 100,
      add column if not exists created_at timestamptz not null default now();
  `);

  await client.query(`
    create index if not exists portal_discord_event_mounts_mount_idx
    on portal_discord_event_mounts (mount_id);
  `);
}

async function ensureDiscordEventAuditTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_event_audit_log (
      id bigserial primary key,
      event_id bigint not null references portal_discord_events(id) on delete cascade,
      action text not null default 'updated',
      changed_by text,
      previous_values jsonb not null default '{}'::jsonb,
      new_values jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create index if not exists portal_discord_event_audit_event_idx
    on portal_discord_event_audit_log (event_id, created_at desc);
  `);
}
async function ensureDiscordEventSignupsTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_event_signups (
      event_id bigint not null references portal_discord_events(id) on delete cascade,
      character_id bigint not null references portal_characters(id) on delete cascade,
      signup_status text not null default 'going',
      role_preference text not null default 'flexible',
      secondary_role_preference text not null default 'none',
      notes text,
      roster_state text not null default 'active',
      party_number integer,
      completed_at timestamptz,
      completed_by text,
      attendance_status text not null default 'not_checked_in',
      checked_in_at timestamptz,
      attendance_updated_at timestamptz,
      attendance_updated_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (event_id, character_id),
      check (signup_status in ('going', 'maybe', 'cant_attend')),
      check (role_preference in ('tank', 'healer', 'melee_dps', 'ranged_dps', 'caster', 'flexible'))
    );
  `);

  await client.query(`
    alter table portal_discord_event_signups
      add column if not exists secondary_role_preference text not null default 'none',
      add column if not exists roster_state text not null default 'active',
      add column if not exists party_number integer,
      add column if not exists completed_at timestamptz,
      add column if not exists completed_by text,
      add column if not exists attendance_status text not null default 'not_checked_in',
      add column if not exists checked_in_at timestamptz,
      add column if not exists attendance_updated_at timestamptz,
      add column if not exists attendance_updated_by text;
  `);

  await client.query(`
    create index if not exists portal_discord_event_signups_character_idx
    on portal_discord_event_signups (character_id, updated_at desc);
  `);

  await client.query(`
    create index if not exists portal_discord_event_signups_event_status_idx
    on portal_discord_event_signups (event_id, signup_status, updated_at);
  `);
  await client.query(`
    create index if not exists portal_discord_event_signups_attendance_idx
    on portal_discord_event_signups (event_id, attendance_status, attendance_updated_at);
  `);
}
async function ensureDiscordDutiesTable(client: Client) {
  await client.query(`
    create table if not exists portal_discord_duties (
      id bigserial primary key,
      duty_type text not null default 'trial',
      name text not null,
      expansion text,
      level integer,
      party_size integer,
      image_url text,
      notes text,
      active boolean not null default true,
      sort_order integer not null default 100,
          external_source text,
          external_id text,
          image_override_url text,
         manual_override boolean not null default false,
          last_synced_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (duty_type, name)
    );
  `);

  await client.query(`
    alter table portal_discord_duties
      add column if not exists duty_type text not null default 'trial',
      add column if not exists name text not null default '',
      add column if not exists expansion text,
      add column if not exists level integer,
      add column if not exists party_size integer,
      add column if not exists image_url text,
      add column if not exists notes text,
      add column if not exists active boolean not null default true,
      add column if not exists sort_order integer not null default 100,
          add column if not exists external_source text,
          add column if not exists external_id text,
          add column if not exists image_override_url text,
          add column if not exists manual_override boolean not null default false,
          add column if not exists last_synced_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);

  await client.query(`
    create index if not exists portal_discord_duties_active_sort_idx
    on portal_discord_duties (active, sort_order, name);
  `);

  await client.query(`
    create unique index if not exists portal_discord_duties_external_source_id_idx
    on portal_discord_duties (external_source, external_id)
    where external_source is not null
      and external_id is not null;
  `);
}

// =========================
// SECTION 05: Database Reads
// =========================

// -------------------------
// SUBSECTION 05A: Portal settings and roles
// -------------------------

async function getPortalIdentityShadowStatus(
  session: PortalSession
): Promise<PortalIdentityShadowStatus> {
  const authentikSubject = String(session?.user?.authentikSubject ?? "").trim();
  const discordUserId = String(session?.user?.discordUserId ?? "").trim();
  const baseStatus: Omit<PortalIdentityShadowStatus, "status"> = {
    authentikSubjectReceived: Boolean(authentikSubject),
    discordClaimReceived: Boolean(discordUserId),
    character_name: null,
    world: null
  };

  if (!discordUserId) {
    return { ...baseStatus, status: "waiting_for_claim" };
  }

  try {
    const client = await getDbClient();

    try {
      const result = await client.query(
        `select c.character_name, c.world, c.active, c.fc_membership_status
         from portal_discord_links dl
         left join portal_characters c on c.id = dl.character_id
         where dl.discord_user_id = $1
         limit 1;`,
        [discordUserId]
      );
      const link = result.rows[0] || null;

      if (!link) {
        return { ...baseStatus, status: "unlinked" };
      }

      return {
        ...baseStatus,
        status:
          link.active === true && link.fc_membership_status === "current"
            ? "matched_current"
            : "matched_ineligible",
        character_name: link.character_name ? String(link.character_name) : null,
        world: link.world ? String(link.world) : null
      };
    } finally {
      await client.end();
    }
  } catch {
    return { ...baseStatus, status: "unavailable" };
  }
}
async function getEligibleMemberCharacter(
  session: PortalSession
): Promise<PortalEligibleMemberCharacter | null> {
  const discordUserId = String(session?.user?.discordUserId ?? "").trim();
  if (!discordUserId) return null;

  try {
    const client = await getDbClient();
    try {
      await ensurePortalSchema(client);
      const selectedId=Number((await cookies()).get("portal_active_character")?.value||0);
      const result = await client.query<{
        id: number;
        character_name: string;
        world: string;
      }>(
        `with membership as (select dl.discord_user_id,dl.character_id anchor_id,coalesce(dl.discord_nickname,dl.discord_display_name,'') current_nickname from portal_discord_links dl join portal_characters anchor on anchor.id=dl.character_id where dl.discord_user_id=$1 and anchor.active=true and anchor.fc_membership_status='current' and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')), choices as (select c.id,c.character_name,c.world,case when lower(trim(c.character_name))=lower(trim(m.current_nickname)) or lower(trim(c.display_name))=lower(trim(m.current_nickname)) then 0 else 1 end priority from membership m join portal_characters c on c.id=m.anchor_id union all select c.id,c.character_name,c.world,case when lower(trim(c.character_name))=lower(trim(m.current_nickname)) or lower(trim(c.display_name))=lower(trim(m.current_nickname)) then 0 else 2 end priority from membership m join portal_alt_character_links acl on acl.discord_user_id=m.discord_user_id and acl.active=true join portal_characters c on c.id=acl.character_id and c.active=true) select id::int,character_name,world from choices order by case when id=$2 then -1 else priority end,priority,id limit 1;`,
        [discordUserId,selectedId]
      );
      const character = result.rows[0] || null;
      return character
        ? { id: Number(character.id), character_name: String(character.character_name), world: String(character.world) }
        : null;
    } finally {
      await client.end();
    }
  } catch {
    return null;
  }
}

async function requireEligibleMemberCharacter(session: PortalSession) {
  const character = await getEligibleMemberCharacter(session);
  if (!character) {
    throw new Error("Member access requires a Discord-linked active character with current Free Company membership.");
  }
  return character;
}

async function getMemberPreferences(
  session: PortalSession,
  character: PortalEligibleMemberCharacter
): Promise<PortalMemberPreferences> {
  const defaults: PortalMemberPreferences = {
    mountWinNotificationsEnabled: true,
    eventReminderLevel: "all",
    defaultEventRole: "flexible",
    secondaryEventRole: "none",
    eventTimeZone: "America/Chicago",
    motionPreference: "automatic",
    layoutDensity: "comfortable",
    textScale: "standard",
    highContrastEnabled: false,
    dataSaverEnabled: false,
    cardFlipEnabled: true,
    timeZoneMode: "central",
    timeFormat: "12",
    animeLanguage: "all",
    animePlatforms: [],
    animeDefaultView: "upcoming",
    hideOwnedMounts: false,
    hideOwnedMinions: false,
    hideOwnedTitles: false,
    hideOwnedAchievements: false,
    defaultMountTab: "collection",
    defaultMinionTab: "collection",
    defaultMinionCategory: "",
    defaultLandingView: "home",
    gamingSetupPublicEnabled: false,
    petPublicEnabled: false,
    glamourPublicEnabled: false,
    artworkPublicEnabled: false
  };
  const discordUserId = String(session?.user?.discordUserId ?? "").trim();
  if (!discordUserId) return defaults;

  const allowedRoles = ["tank", "healer", "melee_dps", "ranged_dps", "caster", "flexible"];
  const allowedMinionCategories = ["", "farmable", "gathering", "gardening", "crafting", "tribal", "island_sanctuary", "pvp", "event", "quest", "vendor", "premium", "achievement", "gold_saucer", "other"];
  const allowedLandingViews = ["home", "announcements", "polls", "events", "crafting", "guides", "members", "mounts", "minions", "titles", "achievements", "anime", "giveaways", "fc-info", "links", "gallery"];

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<any>(
      `select
         c.mount_win_notifications_enabled,
         p.*
       from portal_discord_links dl
       join portal_characters c on c.id = dl.character_id
       left join portal_member_preferences p on p.discord_user_id = dl.discord_user_id
       where dl.discord_user_id = $1
         and c.active = true
         and c.fc_membership_status = 'current'
         and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')
       limit 1;`,
      [discordUserId]
    );
    const p = result.rows[0];
    if (!p) return defaults;
    const reminderLevel = ["all", "final", "none"].includes(String(p.event_reminder_level))
      ? String(p.event_reminder_level)
      : (p.event_reminder_mentions_enabled === false ? "none" : "all");
    return {
      mountWinNotificationsEnabled: p.mount_win_notifications_enabled !== false,
      eventReminderLevel: reminderLevel as "all" | "final" | "none",
      defaultEventRole: allowedRoles.includes(String(p.default_event_role)) ? String(p.default_event_role) : "flexible",
      secondaryEventRole: ["none", ...allowedRoles].includes(String(p.secondary_event_role)) ? String(p.secondary_event_role) : "none",
      eventTimeZone: isSupportedMemberEventTimeZone(String(p.event_time_zone)) ? String(p.event_time_zone) : portalTimeZone,
      motionPreference: ["automatic", "on", "off"].includes(String(p.motion_preference)) ? p.motion_preference : (p.motion_effects_enabled === false ? "off" : "automatic"),
      layoutDensity: p.layout_density === "compact" ? "compact" : "comfortable",
      textScale: ["medium", "large"].includes(String(p.text_scale)) ? p.text_scale : "standard",
      highContrastEnabled: p.high_contrast_enabled === true,
      dataSaverEnabled: p.data_saver_enabled === true,
      cardFlipEnabled: p.card_flip_enabled !== false,
      timeZoneMode: p.time_zone_mode === "local" ? "local" : "central",
      timeFormat: p.time_format === "24" ? "24" : "12",
      animeLanguage: ["sub", "dub"].includes(String(p.anime_language)) ? p.anime_language : "all",
      animePlatforms: String(p.anime_platforms || "").split(",").map((value) => value.trim()).filter(Boolean),
      animeDefaultView: p.anime_default_view === "calendar" ? "calendar" : "upcoming",
      hideOwnedMounts: p.hide_owned_mounts === true,
      hideOwnedMinions: p.hide_owned_minions === true,
      hideOwnedTitles: p.hide_owned_titles === true,
      hideOwnedAchievements: p.hide_owned_achievements === true,
      defaultMountTab: p.default_mount_tab === "marketboard" ? "marketboard" : "collection",
      defaultMinionTab: p.default_minion_tab === "marketboard" ? "marketboard" : "collection",
      defaultMinionCategory: allowedMinionCategories.includes(String(p.default_minion_category || "")) ? String(p.default_minion_category || "") : "",
      defaultLandingView: allowedLandingViews.includes(String(p.default_landing_view)) ? String(p.default_landing_view) : "home",
      gamingSetupPublicEnabled: p.gaming_setup_public_enabled === true,
      petPublicEnabled: p.pet_public_enabled === true,
      glamourPublicEnabled: p.glamour_public_enabled === true,
      artworkPublicEnabled: p.artwork_public_enabled === true
    };
  } finally {
    await client.end();
  }
}
async function getPortalSettings(): Promise<PortalSettings> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const legacySecondaryIds = legacyInstallationAdminDiscordIds.filter((value) => value !== installationPrimaryAdminDiscordId);
    if (legacySecondaryIds.length) {
      await client.query("BEGIN");
      try {
        const marker = await client.query(`insert into portal_settings(key,value,updated_at) values('legacySecondaryAdministratorsMigratedV1','true',now()) on conflict(key) do nothing returning key;`);
        if (marker.rowCount) {
          const current = await client.query<{ value: string }>("select value from portal_settings where key='additionalAdminDiscordIds' limit 1;");
          const merged = [...new Set([...String(current.rows[0]?.value || "").split(","), ...legacySecondaryIds].map((value) => value.trim()).filter((value) => /^\d{15,22}$/.test(value) && value !== installationPrimaryAdminDiscordId))];
          await client.query(`insert into portal_settings(key,value,updated_at) values('additionalAdminDiscordIds',$1,now()) on conflict(key) do update set value=excluded.value,updated_at=now();`, [merged.join(",")]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    }

    const result = await client.query<{ key: string; value: string }>(
      `select key, value from portal_settings;`
    );

    const settings = { ...defaultSettings };
    const storedKeys = new Set(result.rows.map((row) => row.key));

    for (const row of result.rows) {
      if (row.key === "portalLogoUrl" && validBrandingUrl(row.value)) settings.logoUrl = row.value;
      if (row.key === "portalBannerUrl" && validBrandingUrl(row.value)) settings.bannerUrl = row.value;
      if (row.key === "backgroundColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.backgroundColor = row.value;
      if (row.key === "backgroundSecondaryColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.backgroundSecondaryColor = row.value;
      if (row.key === "accentColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.accentColor = row.value;
      if (row.key === "tileColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.tileColor = row.value;
      if (row.key === "sidebarColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.sidebarColor = row.value;
      if (row.key === "insetColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.insetColor = row.value;
      if (row.key === "borderColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.borderColor = row.value;
      if (row.key === "headingColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.headingColor = row.value;
      if (row.key === "textColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.textColor = row.value;
      if (row.key === "mutedTextColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.mutedTextColor = row.value;
      if (row.key === "labelColor" && /^#[0-9a-f]{6}$/i.test(row.value)) settings.labelColor = row.value;
      if (row.key === "additionalAdminDiscordIds") settings.additionalAdminDiscordIds = row.value;
      if (row.key === "discordDisabledCommands") settings.discordDisabledCommands = row.value.split(",").map((value) => value.trim()).filter((value) => disableableDiscordCommands.has(value as never));
      if (row.key === "discordInviteUrl") settings.discordInviteUrl = row.value;
      if (row.key === "discordInvitePublic") settings.discordInvitePublic = row.value !== "false";
      if (row.key === "raidProgressionText") settings.raidProgressionText = row.value;
      if (row.key === "raidScheduleText") settings.raidScheduleText = row.value;
      if (row.key === "raidExpectationsText") settings.raidExpectationsText = row.value;
      if (row.key === "raidRecruitmentText") settings.raidRecruitmentText = row.value;
      if (row.key === "lodestoneUrl") settings.lodestoneUrl = row.value;
      if (row.key === "recruitmentLodestoneUrl") settings.recruitmentLodestoneUrl = row.value;
      if (row.key === "directDiscordContactUrl") settings.directDiscordContactUrl = row.value;
      if (row.key === "welcomeText") settings.welcomeText = row.value;
      if (row.key === "announcementText") settings.announcementText = row.value;
      if (row.key === "fcAboutText") settings.fcAboutText = row.value;
      if (row.key === "fcActivitiesText") settings.fcActivitiesText = row.value;
      if (row.key === "fcScheduleText") settings.fcScheduleText = row.value;
      if (row.key === "fcRecruitmentText") settings.fcRecruitmentText = row.value;
      if (row.key === "fcHouseName") settings.fcHouseName = row.value;
      if (row.key === "fcHouseLocation") settings.fcHouseLocation = row.value;
      if (row.key === "fcHouseDescription") settings.fcHouseDescription = row.value;
      if (row.key === "communityLinkOneLabel") settings.communityLinkOneLabel = row.value;
      if (row.key === "communityLinkOneUrl") settings.communityLinkOneUrl = row.value;
      if (row.key === "communityLinkTwoLabel") settings.communityLinkTwoLabel = row.value;
      if (row.key === "communityLinkTwoUrl") settings.communityLinkTwoUrl = row.value;
      if (row.key === "navigationOrder") {
        try {
          const parsed = JSON.parse(row.value);
          if (Array.isArray(parsed)) settings.navigationOrder = normalizeNavigationOrder(parsed.filter((value): value is PortalView => typeof value === "string") as PortalView[]);
        } catch {
          settings.navigationOrder = [];
        }
      }
    }

    if (!storedKeys.has("backgroundSecondaryColor")) settings.backgroundSecondaryColor = settings.backgroundColor;
    if (!storedKeys.has("sidebarColor")) settings.sidebarColor = settings.tileColor;
    if (!storedKeys.has("insetColor")) settings.insetColor = settings.backgroundColor;
    if (!storedKeys.has("borderColor")) settings.borderColor = settings.accentColor;
    if (!storedKeys.has("labelColor")) settings.labelColor = settings.accentColor;

    return settings;
  } finally {
    await client.end();
  }
}

async function getRoles(): Promise<PortalRole[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query<PortalRole>(`
      select name, sort_order
      from portal_roles
      order by sort_order asc, lower(name) asc;
    `);

    return result.rows;
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05B: Character and member directory reads
// -------------------------

async function getCharacters(filters: CharacterFilters = {}): Promise<PortalCharacter[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const where: string[] = [];
    const params: Array<string | boolean> = [];

    const search = filters.characterSearch?.trim().toLowerCase();
    const roleFilter = filters.roleFilter?.trim();
    const statusFilter = filters.statusFilter?.trim();

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(lower(display_name) like $${params.length} or lower(character_name) like $${params.length} or lower(authentik_email) like $${params.length} or lower(lodestone_character_id) like $${params.length} or lower(ffxiv_collect_character_id) like $${params.length})`
      );
    }

    if (roleFilter) {
      params.push(roleFilter);
      where.push(`role = $${params.length}`);
    }

    if (statusFilter === "active") {
      params.push(true);
      where.push(`active = $${params.length}`);
    }

    if (statusFilter === "inactive") {
      params.push(false);
      where.push(`active = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";

    const result = await client.query<PortalCharacter>(
      `
        select
          id,
          display_name,
          character_name,
          world,
          lodestone_character_id,
          ffxiv_collect_character_id,
          authentik_email,
          portrait_url,
          avatar_url,
          portrait_synced_at,
          role,
          notes,
          active,
          mount_win_notifications_enabled,
          fc_membership_status,
          sync_status,
          last_fc_check_at,
          last_mount_sync_at,
          last_seen_in_fc_at,
          first_seen_in_fc_at,
          join_date_override,
          join_date_source,
          updated_at
        from portal_characters
        ${whereSql}
        order by active desc, lower(display_name), lower(character_name);
      `,
      params
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function getMemberDirectory(
  filters: PortalMemberDirectoryFilters,
  limit = 200
): Promise<PortalMemberDirectoryCharacter[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const search = filters.search.trim();
    const role = filters.role.trim();
    const syncStatus = filters.syncStatus.trim();

    const result = await client.query(
      `
        with active_mounts as (
          select id
          from portal_mounts
          where active = true
        )
        select
          c.id::int,
          c.display_name,
          c.character_name,
          c.world,
          c.portrait_url,
          c.avatar_url,
          c.portrait_synced_at,
          c.role,
          c.fc_rank_name,
          c.fc_rank_changed_at,
          c.sync_status,
          c.first_seen_in_fc_at,
          c.join_date_override,
          c.join_date_source,
          c.last_seen_in_fc_at,
          c.last_mount_sync_at,
          (c.fc_membership_status = 'current') as is_current_fc_member,
          (
            select anchor.character_name
            from portal_alt_character_links acl
            join portal_discord_links dl on dl.discord_user_id = acl.discord_user_id
            join portal_characters anchor on anchor.id = dl.character_id
            where acl.character_id = c.id and acl.active = true
              and anchor.active = true and anchor.fc_membership_status = 'current'
            limit 1
          ) as linked_to_character_name,
          coalesce((
            select json_agg(json_build_object('id', linked.id, 'character_name', linked.character_name, 'world', linked.world) order by lower(linked.character_name))
            from portal_discord_links owner
            join portal_alt_character_links acl on acl.discord_user_id = owner.discord_user_id and acl.active = true
            join portal_characters linked on linked.id = acl.character_id and linked.active = true
            where owner.character_id = c.id
          ), '[]'::json) as linked_characters,
          count(am.id)::int as total_mounts,
          count(cm.mount_id) filter (where cm.owned = true)::int as owned_mounts,
          (
            count(am.id) -
            count(cm.mount_id) filter (where cm.owned = true)
          )::int as missing_mounts,
          case
            when count(am.id) > 0 then
              round(
                (
                  count(cm.mount_id) filter (where cm.owned = true)
                )::numeric / count(am.id)::numeric * 100,
                1
              )
            else 0
          end as collection_rate,
           coalesce(
             (
               select json_agg(
                 json_build_object(
                   'id', h.id,
                   'old_name', h.old_name,
                   'new_name', h.new_name,
                   'detected_at', h.detected_at
                 )
                 order by h.detected_at asc, h.id asc
               )
               from portal_character_rename_history h
               where h.character_id = c.id
             ),
             '[]'::json
           ) as rename_history,
           coalesce(
             (
               select json_agg(
                 json_build_object(
                   'id', h.id,
                   'old_rank_name', h.old_rank_name,
                   'new_rank_name', h.new_rank_name,
                   'old_rank_started_at', h.old_rank_started_at,
                   'detected_at', h.detected_at
                 )
                 order by h.detected_at asc, h.id asc
               )
               from portal_character_fc_rank_history h
               where h.character_id = c.id
             ),
             '[]'::json
           ) as rank_history
        from portal_characters c
        left join active_mounts am on true
        left join portal_character_mounts cm
          on cm.character_id = c.id
         and cm.mount_id = am.id
        where c.id in (select id from portal_tracked_characters)
          and (
            $2::text = ''
            or lower(c.display_name) like '%' || lower($2::text) || '%'
            or lower(c.character_name) like '%' || lower($2::text) || '%'
            or lower(c.role) like '%' || lower($2::text) || '%'
            or lower(coalesce(c.fc_rank_name, '')) like '%' || lower($2::text) || '%'
            or exists(select 1 from portal_discord_links owner join portal_alt_character_links acl on acl.discord_user_id=owner.discord_user_id and acl.active=true join portal_characters linked on linked.id=acl.character_id where owner.character_id=c.id and lower(linked.character_name) like '%' || lower($2::text) || '%')
          )
          and ($3::text = '' or c.role = $3::text)
          and ($4::text = '' or c.sync_status = $4::text)
        group by
          c.id,
          c.display_name,
          c.character_name,
          c.world,
          c.portrait_url,
          c.avatar_url,
          c.portrait_synced_at,
          c.role,
          c.fc_rank_name,
          c.fc_rank_changed_at,
          c.sync_status,
          c.first_seen_in_fc_at,
          c.join_date_override,
          c.join_date_source,
          c.last_seen_in_fc_at,
          c.last_mount_sync_at,
          c.fc_membership_status
        order by lower(c.display_name) asc
        limit $1;
      `,
      [limit, search, role, syncStatus]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      display_name: row.display_name,
      character_name: row.character_name,
      world: row.world,
      portrait_url: row.portrait_url,
      avatar_url: row.avatar_url,
      portrait_synced_at: row.portrait_synced_at,
      role: row.role,
      fc_rank_name: row.fc_rank_name,
      fc_rank_changed_at: row.fc_rank_changed_at,
      sync_status: row.sync_status,
      first_seen_in_fc_at: row.first_seen_in_fc_at,
      join_date_override: row.join_date_override,
      join_date_source: row.join_date_source,
      last_seen_in_fc_at: row.last_seen_in_fc_at,
      last_mount_sync_at: row.last_mount_sync_at,
      is_current_fc_member: row.is_current_fc_member === true,
      linked_to_character_name: row.linked_to_character_name || null,
      linked_characters: Array.isArray(row.linked_characters) ? row.linked_characters.map((linked) => ({ id: Number(linked.id), character_name: String(linked.character_name || ''), world: String(linked.world || '') })) : [],
      total_mounts: Number(row.total_mounts ?? 0),
      owned_mounts: Number(row.owned_mounts ?? 0),
      missing_mounts: Number(row.missing_mounts ?? 0),
      collection_rate: Number(row.collection_rate ?? 0),
      rename_history: Array.isArray(row.rename_history)
        ? row.rename_history.map((history) => ({
            id: Number(history.id),
            old_name: String(history.old_name || ''),
            new_name: String(history.new_name || ''),
            detected_at: String(history.detected_at || '')
          }))
        : [],
      rank_history: Array.isArray(row.rank_history)
        ? row.rank_history.map((history) => ({
            id: Number(history.id),
            old_rank_name: String(history.old_rank_name || ''),
            new_rank_name: String(history.new_rank_name || ''),
            old_rank_started_at: history.old_rank_started_at
              ? String(history.old_rank_started_at)
              : null,
            detected_at: String(history.detected_at || '')
          }))
        : []
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05C: Worker sync status reads
// -------------------------

async function getOfficerActivityLog(filters: OfficerActivityFilters, requestedPage = 1, pageSize = 25): Promise<{
  entries: OfficerActivityEntry[]; total: number; page: number; pageSize: number; totalPages: number;
  filters: OfficerActivityFilters; sources: string[]; usage: OfficerCommandUsage[];
}> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const source = filters.source || "all", outcome = filters.outcome || "all", search = filters.search.trim(), windowDays = [1, 7, 30, 90].includes(filters.windowDays) ? filters.windowDays : 30;
    const activitySql = `
      select 'fae:' || d.id::text as id, 'Discord Commands' as source, d.interaction_kind as category,
        d.outcome, case when d.outcome='failure' then coalesce(d.character_name,d.discord_display_name,d.discord_username,d.discord_user_id,'Unknown member') else 'Anonymous member' end as actor,
        d.command_path as action, case when d.outcome='failure' then concat_ws(' · ',nullif(d.failure_stage,''),nullif(d.error_message,'')) else null end summary,
        d.created_at occurred_at, d.reference_id, d.duration_ms from portal_command_diagnostics d
      union all select 'discord:'||a.id::text,'Discord Automation','verification',case when a.result in ('matched','success','completed') then 'success' when a.result in ('failed','denied','error') then 'failure' else 'info' end,
        coalesce(c.character_name,a.discord_display_name,a.discord_nickname,a.discord_global_name,a.discord_username,a.discord_user_id,'Unknown user'),a.attempt_type,a.reason,a.created_at,null::text,null::integer from portal_discord_audit_log a left join portal_characters c on c.id=a.character_id
      union all select 'discord-action:'||q.id::text,'Discord Automation','queued action',
        case when q.status='failed' or nullif(q.error_message,'') is not null then 'failure' when q.status in ('completed','archived') and nullif(q.result_message,'') is not null then 'success' else 'info' end,
        coalesce(nullif(q.requested_by,''),'Portal officer'),initcap(replace(q.action_type,'_',' ')),
        concat_ws(' · ',nullif(q.result_message,''),nullif(q.error_message,''),case when q.status not in ('completed','failed','archived') then 'Status: '||q.status else null end),
        coalesce(q.completed_at,q.requested_at),q.id::text,null::integer from portal_discord_action_queue q
      union all select 'sync:'||s.id::text,'Worker Sync',s.sync_type,case when s.status in ('success','completed') then 'success' when s.status in ('failed','error') then 'failure' else 'info' end,'Background worker',s.sync_type,s.message,s.started_at,null::text,case when s.finished_at is not null then greatest(0,extract(epoch from(s.finished_at-s.started_at))*1000)::integer else null::integer end from portal_sync_runs s
      union all select 'collection-source:'||w.id::text,'Worker Sync','collection source mapping',case when w.resolved_at is null then 'failure' else 'info' end,'Background worker','Unmapped '||w.source_type||' source',concat(w.catalog_name,' · ',w.affected_count,' affected item(s)',case when jsonb_array_length(w.example_items)>0 then ' · Examples: '||(select string_agg(value,', ') from jsonb_array_elements_text(w.example_items)) else '' end,case when w.resolved_at is not null then ' · Resolved' else '' end),coalesce(w.resolved_at,w.last_observed_at),w.id::text,null::integer from portal_collection_source_warnings w
      union all select 'roster:'||r.id::text,'FC Roster',r.scan_source,'info',r.character_name,'Member '||r.change_type,r.world,r.detected_at,null::text,null::integer from portal_fc_roster_change_log r
      union all select 'rename:'||h.id::text,'Character Renames','roster','info',coalesce(c.display_name,c.character_name,h.new_name),'Character renamed',h.old_name||' → '||h.new_name,h.detected_at,null::text,null::integer from portal_character_rename_history h left join portal_characters c on c.id=h.character_id
      union all select 'event:'||a.id::text,'Events','officer action','info',coalesce(a.changed_by,'Unknown actor'),a.action,e.title,a.created_at,null::text,null::integer from portal_discord_event_audit_log a join portal_discord_events e on e.id=a.event_id
      union all select 'giveaway:'||a.id::text,'Giveaways','activity','info',coalesce(a.actor_label,a.actor_discord_user_id,'Automation'),a.action_type,g.title,a.created_at,null::text,null::integer from portal_giveaway_audit a left join portal_giveaways g on g.id=a.giveaway_id
      union all select 'poll:'||a.id::text,'Polls','activity','info',coalesce(a.actor_label,'Automation'),a.action_type,p.question,a.created_at,null::text,null::integer from portal_poll_audit a left join portal_polls p on p.id=a.poll_id`;
    const where = `where occurred_at >= now()-make_interval(days => $3::int) and ($1='all' or source=$1) and ($2='all' or outcome=$2) and ($4='' or concat_ws(' ',actor,action,summary,reference_id,source,category) ilike '%'||$4||'%')`;
    const countResult = await client.query(`with activity as (${activitySql}) select count(*)::int total from activity ${where};`, [source, outcome, windowDays, search]);
    const total = Number(countResult.rows[0]?.total || 0), totalPages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(Math.max(1, requestedPage), totalPages);
    // node-postgres clients execute one query at a time. Running these through
    // Promise.all reused the same connection concurrently and could terminate
    // the Officer Area request on newer pg releases.
    const result = await client.query(
      `with activity as (${activitySql}) select * from activity ${where} order by occurred_at desc limit $5 offset $6;`,
      [source, outcome, windowDays, search, pageSize, (page - 1) * pageSize]
    );
    const usageResult = await client.query(`select command_path,coalesce(sum(invocation_count)filter(where usage_date>=current_date-29),0)::int days_30,coalesce(sum(invocation_count)filter(where usage_date>=current_date-59),0)::int days_60,coalesce(sum(invocation_count),0)::int days_90 from portal_command_usage_daily where usage_date>=current_date-89 group by command_path order by days_30 desc,command_path;`);
    return { entries: result.rows.map(row => ({ id:String(row.id), source:String(row.source), category:String(row.category), outcome:row.outcome==='success'||row.outcome==='failure'?row.outcome:'info', actor:String(row.actor||'Unknown actor'), action:String(row.action||'Activity'), summary:row.summary?String(row.summary):null, occurred_at:String(row.occurred_at), reference_id:row.reference_id?String(row.reference_id):null, duration_ms:row.duration_ms===null?null:Number(row.duration_ms) })), total, page, pageSize, totalPages, filters:{ search, source, outcome, windowDays }, sources:['Character Renames','Discord Automation','Discord Commands','Events','FC Roster','Giveaways','Polls','Worker Sync'], usage:usageResult.rows.map(row=>({command_path:String(row.command_path),days_30:Number(row.days_30),days_60:Number(row.days_60),days_90:Number(row.days_90)})) };
  } finally { await client.end(); }
}
async function getSyncRuns(limit = 8): Promise<PortalSyncRun[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query<PortalSyncRun>(
      `
        select
          id,
          sync_type,
          status,
          message,
          started_at,
          finished_at
        from portal_sync_runs
        order by started_at desc
        limit $1;
      `,
      [limit]
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function getFcRosterAuditChanges(limit = 20): Promise<PortalFcRosterChange[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalFcRosterChange>(
      `select id, scan_source, change_type, character_name, world, lodestone_character_id, detected_at
       from portal_fc_roster_change_log
       order by detected_at desc
       limit $1;`,
      [limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05D: Mount tracker summary reads
// -------------------------

async function getMountSetSummaries(): Promise<PortalMountSetSummary[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query<PortalMountSetSummary>(`
      select
        ms.id,
        ms.name,
        ms.expansion,
        ms.sort_order,
        count(m.id)::int as mount_count,
        count(m.id) filter (where m.active = true)::int as active_mount_count
      from portal_mount_sets ms
      left join portal_mounts m on m.mount_set_id = ms.id
      where ms.active = true
      group by ms.id, ms.name, ms.expansion, ms.sort_order
      order by ms.sort_order asc, lower(ms.name) asc;
    `);

    return result.rows;
  } finally {
    await client.end();
  }
}

async function getMountSetProgress(): Promise<PortalMountSetProgress[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(`
      with current_characters as (
        select id from portal_tracked_characters
      )
      select
        ms.id::int as id,
        ms.name,
        ms.expansion,
        ms.sort_order,
        count(distinct m.id)::int as active_mount_count,
        (select count(*) from current_characters)::int as tracked_characters,
        (
          count(distinct m.id) * (select count(*) from current_characters)
        )::int as total_possible,
        count(cm.mount_id) filter (where cm.owned = true)::int as owned_count,
        greatest(
          (
            count(distinct m.id) * (select count(*) from current_characters)
          ) - count(cm.mount_id) filter (where cm.owned = true),
          0
        )::int as missing_count,
        case
          when (
            count(distinct m.id) * (select count(*) from current_characters)
          ) > 0 then
            round(
              (
                count(cm.mount_id) filter (where cm.owned = true)::numeric
                / (
                  count(distinct m.id)::numeric
                  * (select count(*) from current_characters)::numeric
                )
              ) * 100,
              1
            )
          else 0
        end as collection_rate
      from portal_mount_sets ms
      left join portal_mounts m
        on m.mount_set_id = ms.id
       and m.active = true
      left join portal_character_mounts cm
        on cm.mount_id = m.id
       and cm.character_id in (select id from current_characters)
      where ms.active = true
      group by ms.id, ms.name, ms.expansion, ms.sort_order
      order by ms.sort_order asc, lower(ms.name) asc;
    `);

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      expansion: row.expansion,
      sort_order: Number(row.sort_order),
      active_mount_count: Number(row.active_mount_count ?? 0),
      tracked_characters: Number(row.tracked_characters ?? 0),
      total_possible: Number(row.total_possible ?? 0),
      owned_count: Number(row.owned_count ?? 0),
      missing_count: Number(row.missing_count ?? 0),
      collection_rate: Number(row.collection_rate ?? 0)
    }));
  } finally {
    await client.end();
  }
}

async function getMountTrackerStats(): Promise<PortalMountTrackerStats> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(`
      with
        current_characters as (
          select id from portal_tracked_characters
        ),
        active_mounts as (
          select id
          from portal_mounts
          where active = true
        ),
        owned_rows as (
          select cm.character_id, cm.mount_id
          from portal_character_mounts cm
          join current_characters c on c.id = cm.character_id
          join active_mounts m on m.id = cm.mount_id
          where cm.owned = true
        )
      select
        (select count(*) from current_characters)::int as tracked_characters,
        (select count(*) from active_mounts)::int as total_mounts,
        ((select count(*) from current_characters) * (select count(*) from active_mounts))::int as total_possible,
        (select count(*) from owned_rows)::int as owned_count;
    `);

    const row = result.rows[0];

    const trackedCharacters = Number(row.tracked_characters ?? 0);
    const totalMounts = Number(row.total_mounts ?? 0);
    const totalPossible = Number(row.total_possible ?? 0);
    const ownedCount = Number(row.owned_count ?? 0);
    const missingCount = Math.max(totalPossible - ownedCount, 0);
    const collectionRate =
      totalPossible > 0 ? Number(((ownedCount / totalPossible) * 100).toFixed(1)) : 0;

    return {
      tracked_characters: trackedCharacters,
      total_mounts: totalMounts,
      total_possible: totalPossible,
      owned_count: ownedCount,
      missing_count: missingCount,
      collection_rate: collectionRate
    };
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05E: Mount tracker character progress reads
// -------------------------

async function getCharacterMountProgress(
  limit = 150,
  mountSetId?: number,
  filters?: PortalMountTrackerFilters
): Promise<PortalCharacterMountProgress[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

  const selectedMountSetId =
      Number.isFinite(mountSetId) && mountSetId && mountSetId > 0
        ? mountSetId
        : null;

    const search = filters?.search?.trim() ?? "";
    const role = filters?.role?.trim() ?? "";
    const syncStatus = filters?.syncStatus?.trim() ?? "";

    const result = await client.query(
      `
        with active_mounts as (
          select id
          from portal_mounts
          where active = true
            and ($2::bigint is null or mount_set_id = $2::bigint)
        )
        select
          c.id::int as character_id,
          c.display_name,
          c.character_name,
          c.world,
          c.role,
          c.sync_status,
          count(am.id)::int as total_mounts,
          count(cm.mount_id) filter (where cm.owned = true)::int as owned_mounts,
          (
            count(am.id) -
            count(cm.mount_id) filter (where cm.owned = true)
          )::int as missing_mounts,
          case
            when count(am.id) > 0 then
              round(
                (
                  count(cm.mount_id) filter (where cm.owned = true)
                )::numeric / count(am.id)::numeric * 100,
                1
              )
            else 0
          end as collection_rate,
          c.last_mount_sync_at
        from portal_characters c
        cross join active_mounts am
        left join portal_character_mounts cm
          on cm.character_id = c.id
         and cm.mount_id = am.id
        where c.id in (select id from portal_tracked_characters)
          and (
            $3::text = ''
            or lower(c.display_name) like '%' || lower($3::text) || '%'
            or lower(c.character_name) like '%' || lower($3::text) || '%'
          )
          and ($4::text = '' or c.role = $4::text)
          and ($5::text = '' or c.sync_status = $5::text)
        group by
          c.id,
          c.display_name,
          c.character_name,
          c.world,
          c.role,
          c.sync_status,
          c.last_mount_sync_at
        order by
          collection_rate asc,
          missing_mounts desc,
          lower(c.display_name) asc
        limit $1;
      `,
      [limit, selectedMountSetId, search, role, syncStatus]
    );

    return result.rows.map((row) => ({
      character_id: Number(row.character_id),
      display_name: row.display_name,
      character_name: row.character_name,
      world: row.world,
      role: row.role,
      sync_status: row.sync_status,
      total_mounts: Number(row.total_mounts ?? 0),
      owned_mounts: Number(row.owned_mounts ?? 0),
      missing_mounts: Number(row.missing_mounts ?? 0),
      collection_rate: Number(row.collection_rate ?? 0),
      last_mount_sync_at: row.last_mount_sync_at
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05F: Mount tracker planning reads
// -------------------------

async function getMostNeededMounts(
  limit = 12,
  mountSetId?: number
): Promise<PortalMostNeededMount[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

  const selectedMountSetId =
      Number.isFinite(mountSetId) && mountSetId && mountSetId > 0
        ? mountSetId
        : null;

    const result = await client.query(
      `
        with current_characters as (
          select id from portal_tracked_characters
        ),
        mount_ownership as (
          select
            m.id as mount_id,
            m.mount_name,
            m.source_name,
            m.patch,
            m.icon_url,
            ms.name as set_name,
            ms.expansion,
            count(c.id)::int as tracked_characters,
            count(cm.mount_id) filter (where cm.owned = true)::int as owned_count,
            (
              count(c.id) -
              count(cm.mount_id) filter (where cm.owned = true)
            )::int as missing_count
          from portal_mounts m
          join portal_mount_sets ms on ms.id = m.mount_set_id
          cross join current_characters c
          left join portal_character_mounts cm
            on cm.mount_id = m.id
           and cm.character_id = c.id
          where m.active = true
            and ms.active = true
            and ($2::bigint is null or m.mount_set_id = $2::bigint)
          group by
            m.id,
            m.mount_name,
            m.source_name,
            m.patch,
            m.icon_url,
            ms.name,
            ms.expansion
        )
        select
          mount_id::int,
          mount_name,
          source_name,
          patch,
          icon_url,
          set_name,
          expansion,
          tracked_characters,
          owned_count,
          missing_count,
          case
            when tracked_characters > 0 then
              round((missing_count::numeric / tracked_characters::numeric) * 100, 1)
            else 0
          end as missing_rate
        from mount_ownership
        where missing_count > 0
        order by
          missing_count desc,
          lower(mount_name) asc
        limit $1;
      `,
      [limit, selectedMountSetId]
    );

    return result.rows.map((row) => ({
      mount_id: Number(row.mount_id),
      mount_name: row.mount_name,
      source_name: row.source_name,
      patch: row.patch,
      icon_url: row.icon_url,
      set_name: row.set_name,
      expansion: row.expansion,
      tracked_characters: Number(row.tracked_characters ?? 0),
      owned_count: Number(row.owned_count ?? 0),
      missing_count: Number(row.missing_count ?? 0),
      missing_rate: Number(row.missing_rate ?? 0)
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05G: Recent mount wins reads
// -------------------------

async function getPortalAnnouncements(limit = 12): Promise<PortalAnnouncement[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalAnnouncement>(
      `
        select id::int, title, body, category, created_by, published_at
        from portal_announcements
        where archived_at is null
          and published_at <= now()
        order by published_at desc, id desc
        limit $1;
      `,
      [limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

async function getAnnouncementEvents(limit = 6): Promise<PortalAnnouncementEvent[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalAnnouncementEvent>(
      `
        select
          e.id::int,
          e.event_type,
          e.title,
          e.description,
          e.duty_name,
          e.event_starts_at,
          (
            select m.mount_name
            from portal_discord_event_mounts em
            join portal_mounts m on m.id = em.mount_id
            where em.event_id = e.id
            order by em.sort_order asc, em.mount_id asc
            limit 1
          ) as mount_name
        from portal_discord_events e
        where e.status = 'planned'
          and e.event_starts_at >= now() - interval '2 hours'
        order by e.event_starts_at asc
        limit $1;
      `,
      [limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

async function getAnnouncementRenames(limit = 6): Promise<PortalAnnouncementRename[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalAnnouncementRename>(
      `
        select
          h.id::int,
          h.old_name,
          h.new_name,
          h.detected_at,
          coalesce(c.portrait_url, c.avatar_url) as portrait_url
        from portal_character_rename_history h
        join portal_characters c on c.id = h.character_id
        where c.active = true
          and c.fc_membership_status = 'current'
        order by h.detected_at desc, h.id desc
        limit $1;
      `,
      [limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}
async function getGuideResources(includeMemberOnly = false): Promise<PortalGuideResource[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalGuideResource>(`
      select id::int, category, title, body, url, sort_order,
             case when visibility_mode = 'public' then 'public' else 'members' end as visibility_mode
      from portal_guide_resources
      where archived_at is null
        and (visibility_mode = 'public' or $1::boolean)
      order by sort_order asc, created_at asc, id asc;
    `, [includeMemberOnly]);
    return result.rows;
  } finally {
    await client.end();
  }
}
async function getFcInfoCards(): Promise<PortalFcInfoCard[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalFcInfoCard>(`
      select id::int, label, title, body, sort_order
      from portal_fc_info_cards
      where archived_at is null
      order by sort_order asc, created_at asc, id asc;
    `);
    return result.rows;
  } finally {
    await client.end();
  }
}
async function getFcInfoLead(): Promise<PortalFcInfoLead | null> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalFcInfoLead>(
      `
        select display_name, character_name, world, role,
               coalesce(portrait_url, avatar_url) as portrait_url
        from portal_characters
        where lower(coalesce(role, '')) = 'officer'
          and active = true
          and fc_membership_status = 'current'
        order by lower(coalesce(display_name, character_name))
        limit 1;
      `
    );
    return result.rows[0] || null;
  } finally {
    await client.end();
  }
}

async function getFcGalleryImages(limit = 18): Promise<PortalGalleryImage[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalGalleryImage>(
      `
        select id::int, title, alt_text, mime_type, created_by, created_at
        from portal_fc_gallery_images
        where archived_at is null
        order by created_at desc, id desc
        limit $1;
      `,
      [limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}
async function getPortalLinkCards(): Promise<PortalLinkCard[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalLinkCard>(`
      select id::int, label, url, description, sort_order,
             (image_data is not null) as has_custom_image,
             created_at
      from portal_link_cards
      where archived_at is null
      order by sort_order asc, created_at asc, id asc;
    `);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function getCommunityGalleryPosts(category: PortalCommunityGalleryPost["category"], includeReviewed = false, canAccessMemberArtwork = false): Promise<PortalCommunityGalleryPost[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalCommunityGalleryPost & { images: unknown }>(`
      select
        p.id::int,
        p.category,
        p.discord_display_name,
        c.character_name,
        p.display_name_override,
        p.caption,
        p.posted_at,
        p.review_status,
        p.review_note,
        coalesce(mp.artwork_public_enabled, false) as artwork_public_enabled,
        coalesce(
          json_agg(json_build_object('id', i.id::int, 'filename', i.filename) order by i.id)
          filter (where i.id is not null),
          '[]'::json
        ) as images
      from portal_community_gallery_posts p
      left join portal_discord_links dl on dl.discord_user_id = p.discord_user_id
      left join portal_characters c on c.id = dl.character_id
      left join portal_member_preferences mp on mp.discord_user_id = p.discord_user_id
      left join portal_community_gallery_images i on i.post_id = p.id
      where p.category = $1
        and (
          $2::boolean
          or (
            p.review_status = 'approved'
            and (p.category <> 'artwork' or $3::boolean or coalesce(mp.artwork_public_enabled, false))
          )
        )
      group by p.id, c.character_name, mp.artwork_public_enabled
      order by p.posted_at desc, p.id desc;
    `, [category, includeReviewed, canAccessMemberArtwork]);
    return result.rows.map((row) => ({
      ...row,
      images: Array.isArray(row.images) ? row.images as PortalCommunityGalleryImage[] : []
    }));
  } finally {
    await client.end();
  }
}

async function getCommunityGalleryImportRequests(): Promise<PortalCommunityGalleryImport[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalCommunityGalleryImport>(`
      select category, status, scanned_messages, imported_posts, requested_at, completed_at, error_text
      from portal_community_gallery_import_requests
      order by category;
    `);
    return result.rows;
  } finally {
    await client.end();
  }
}
function automaticLinkCardImage(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "discord.com" || hostname.endsWith(".discord.com") || hostname === "discord.gg") {
      return "https://cdn.simpleicons.org/discord/5865F2";
    }
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.origin)}&sz=128`;
  } catch {
    return "";
  }
}

async function getRecentMountAcquisitions(limit = 12): Promise<PortalMountAcquisition[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          a.id::int,
          a.character_id::int,
          a.mount_id::int,
          coalesce(c.display_name, a.character_name) as character_name,
          coalesce(m.mount_name, a.mount_name) as mount_name,
          m.source_name,
          ms.name as set_name,
          ms.expansion,
          a.detected_at,
          a.is_test,
          a.discord_sent_at,
          a.discord_error
        from portal_mount_acquisitions a
        left join portal_characters c on c.id = a.character_id
        left join portal_mounts m on m.id = a.mount_id
        left join portal_mount_sets ms on ms.id = m.mount_set_id
        where coalesce(a.is_test, false) = false
        order by a.detected_at desc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      character_id: Number(row.character_id),
      mount_id: Number(row.mount_id),
      character_name: row.character_name,
      mount_name: row.mount_name,
      source_name: row.source_name,
      set_name: row.set_name,
      expansion: row.expansion,
      detected_at: row.detected_at,
      is_test: Boolean(row.is_test),
      discord_sent_at: row.discord_sent_at,
      discord_error: row.discord_error
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05H: Party planner reads
// -------------------------

async function getPartyCharacterOptions(search = ""): Promise<PortalPartyCharacterOption[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query<PortalPartyCharacterOption>(
      `
        select
          c.id::int,
          c.display_name,
          c.character_name,
          c.world,
          c.role,
          c.sync_status,
          coalesce('discord:' || alt_owner.discord_user_id, 'discord:' || anchor_owner.discord_user_id, 'character:' || c.id::text) as owner_key
        from portal_characters c
        left join portal_alt_character_links alt_owner on alt_owner.character_id=c.id and alt_owner.active=true
        left join portal_discord_links anchor_owner on anchor_owner.character_id=c.id
        where c.id in (select id from portal_tracked_characters)
          and (
            $1::text = ''
            or lower(c.display_name) like '%' || lower($1::text) || '%'
            or lower(c.character_name) like '%' || lower($1::text) || '%'
            or lower(c.role) like '%' || lower($1::text) || '%'
            or lower(c.sync_status) like '%' || lower($1::text) || '%'
          )
        order by lower(c.display_name) asc
        limit 125;
      `,
      [search.trim()]
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function getPartyFarmTargets(
  characterIds: number[],
  mountSetId?: number,
  limit = 16
): Promise<PortalPartyFarmTarget[]> {
  const selectedIds = [...new Set(characterIds)]
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, 8);

  if (selectedIds.length === 0) {
    return [];
  }

  const selectedMountSetId =
    Number.isFinite(mountSetId) && mountSetId && mountSetId > 0
      ? mountSetId
      : null;

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        with eligible_characters as (
          select c.id,c.display_name,
            coalesce('discord:' || alt_owner.discord_user_id, 'discord:' || anchor_owner.discord_user_id, 'character:' || c.id::text) owner_key
          from portal_characters c
          left join portal_alt_character_links alt_owner on alt_owner.character_id=c.id and alt_owner.active=true
          left join portal_discord_links anchor_owner on anchor_owner.character_id=c.id
          where c.id in (select id from portal_tracked_characters) and c.id = any($1::int[])
        ), selected_characters as (
          select distinct on (owner_key) id,display_name
          from eligible_characters
          order by owner_key,array_position($1::int[],id)
        ),
        active_mounts as (
          select
            m.id,
            m.mount_name,
            m.source_name,
            m.patch,
            m.icon_url,
            ms.name as set_name,
            ms.expansion
          from portal_mounts m
          join portal_mount_sets ms on ms.id = m.mount_set_id
          where m.active = true
            and ms.active = true
            and ($2::bigint is null or m.mount_set_id = $2::bigint)
        )
        select
          am.id::int as mount_id,
          am.mount_name,
          am.source_name,
          am.patch,
          am.icon_url,
          am.set_name,
          am.expansion,
          count(sc.id)::int as selected_count,
          count(sc.id) filter (where coalesce(cm.owned, false) = false)::int as missing_count,
          count(sc.id) filter (where coalesce(cm.owned, false) = true)::int as owned_count,
          coalesce(
            array_agg(sc.display_name order by lower(sc.display_name))
              filter (where coalesce(cm.owned, false) = false),
            '{}'::text[]
          ) as missing_names,
          coalesce(
            array_agg(sc.display_name order by lower(sc.display_name))
              filter (where coalesce(cm.owned, false) = true),
            '{}'::text[]
          ) as owned_names
        from active_mounts am
        cross join selected_characters sc
        left join portal_character_mounts cm
          on cm.mount_id = am.id
         and cm.character_id = sc.id
        group by
          am.id,
          am.mount_name,
          am.source_name,
          am.patch,
          am.icon_url,
          am.set_name,
          am.expansion
        having count(sc.id) filter (where coalesce(cm.owned, false) = false) > 0
        order by
          missing_count desc,
          owned_count asc,
          lower(am.mount_name) asc
        limit $3;
      `,
      [selectedIds, selectedMountSetId, limit]
    );

    return result.rows.map((row) => ({
      mount_id: Number(row.mount_id),
      mount_name: row.mount_name,
      source_name: row.source_name,
      patch: row.patch,
      icon_url: row.icon_url,
      set_name: row.set_name,
      expansion: row.expansion,
      selected_count: Number(row.selected_count ?? 0),
      missing_count: Number(row.missing_count ?? 0),
      owned_count: Number(row.owned_count ?? 0),
      missing_names: Array.isArray(row.missing_names) ? row.missing_names : [],
      owned_names: Array.isArray(row.owned_names) ? row.owned_names : []
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05I: Officer mount management reads
// -------------------------

async function getManagedMounts(
  filters: PortalManagedMountFilters,
  limit = 200
): Promise<PortalManagedMount[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query<PortalManagedMount>(
      `
        select
          m.id::int,
          m.mount_name,
          m.source_name,
          m.patch,
          m.mount_category,
          m.farm_priority,
          m.active,
          m.manual_override,
          ms.name as set_name,
          ms.expansion
        from portal_mounts m
        left join portal_mount_sets ms on ms.id = m.mount_set_id
        where
          (
            $2::text = ''
            or lower(m.mount_name) like '%' || lower($2::text) || '%'
            or lower(coalesce(m.source_name, '')) like '%' || lower($2::text) || '%'
            or lower(coalesce(ms.name, '')) like '%' || lower($2::text) || '%'
            or lower(coalesce(ms.expansion, '')) like '%' || lower($2::text) || '%'
          )
          and ($3::text = '' or m.mount_category = $3::text)
          and ($4::text = '' or m.farm_priority = $4::text)
          and (
            $5::text = ''
            or ($5::text = 'active' and m.active = true)
            or ($5::text = 'hidden' and m.active = false)
          )
          and (
            $6::text = ''
            or ($6::text = 'manual' and m.manual_override = true)
            or ($6::text = 'auto' and m.manual_override = false)
          )
        order by
          m.active desc,
          case
            when m.farm_priority = 'farm_target' then 1
            when m.farm_priority = 'optional' then 2
            else 3
          end,
          lower(m.mount_name) asc
        limit $1;
      `,
      [
        limit,
        filters.search,
        filters.category,
        filters.farmPriority,
        filters.visibility,
        filters.overrideStatus
      ]
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function getMountWinTestOptions(): Promise<PortalMountWinTestOption[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalMountWinTestOption>(`
      select
        m.id::int,
        m.mount_name,
        m.source_name,
        m.image_url,
        m.icon_url,
        ms.name as set_name,
        ms.expansion
      from portal_mounts m
      left join portal_mount_sets ms on ms.id = m.mount_set_id
      where m.active = true
      order by lower(m.mount_name) asc;
    `);
    return result.rows;
  } finally {
    await client.end();
  }
}
// -------------------------
// SUBSECTION 05J: Character mount detail reads
// -------------------------

const MOUNT_CATEGORY_CASE_SQL = `
  case
    when lower(m.mount_name) = any(array['silkie','sil''dihn throne','burabura chochin','shishioji','spectral statice','quaqua']) then 'duty'
    when m.mount_category in ('Trial','Raid','Dungeon','Dungeon / Criterion','Variant / Criterion') then 'duty'
    when lower(coalesce(m.source_name, '')) like any(array['%trial:%','%raid:%','%dungeon:%','%criterion%','%variant%','%fate:%','%eureka:%','%bozja:%','%occult crescent:%']) then 'duty'
    when lower(coalesce(m.source_name, '')) like '%achievement:%' then 'achievement'
    when lower(coalesce(m.source_name, '')) like any(array['%crafting:%','%skybuilders:%','%scrip%']) then 'crafting'
    when lower(coalesce(m.source_name, '')) like any(array['%gathering:%','%venture:%','%voyage:%']) then 'gathering'
    when lower(coalesce(m.source_name, '')) like any(array['%tribal:%','%beast tribe:%']) then 'tribal'
    when lower(coalesce(m.source_name, '')) like '%island sanctuary:%' then 'island_sanctuary'
    when lower(coalesce(m.source_name, '')) like '%pvp:%' then 'pvp'
    when lower(coalesce(m.source_name, '')) like any(array['%event:%','%seasonal%']) then 'event'
    when lower(coalesce(m.source_name, '')) like '%quest:%' then 'quest'
    when lower(coalesce(m.source_name, '')) like '%gold saucer:%' then 'gold_saucer'
    when lower(coalesce(m.source_name, '')) like any(array['%premium:%','%online store%','%mog station%']) then 'premium'
    when lower(coalesce(m.source_name, '')) like any(array['%purchase:%','%vendor:%','%bicolor gemstone%']) then 'vendor'
    when m.marketboard_eligible = true then 'marketboard'
    else 'other'
  end
`;
const MOUNT_CATEGORY_METADATA: Record<PortalMountCategoryKey, { name: string; sortOrder: number }> = {
  duty: { name: "Duty / Farmed", sortOrder: 10 }, achievement: { name: "Achievements", sortOrder: 20 }, crafting: { name: "Crafting / Scrips", sortOrder: 30 }, gathering: { name: "Gathering / Ventures", sortOrder: 40 }, tribal: { name: "Tribal Quests", sortOrder: 50 }, island_sanctuary: { name: "Island Sanctuary", sortOrder: 60 }, pvp: { name: "PvP", sortOrder: 70 }, event: { name: "Seasonal Events", sortOrder: 80 }, quest: { name: "Quests", sortOrder: 90 }, vendor: { name: "Vendors / Currency", sortOrder: 100 }, premium: { name: "Premium", sortOrder: 110 }, gold_saucer: { name: "Gold Saucer", sortOrder: 120 }, marketboard: { name: "Marketboard", sortOrder: 130 }, other: { name: "Other Sources", sortOrder: 140 }
};
function getMountCategoryMetadata(key: string) { return MOUNT_CATEGORY_METADATA[key as PortalMountCategoryKey] ?? MOUNT_CATEGORY_METADATA.other; }

async function getMountGuideStats(): Promise<PortalMountGuideStats> {
  const client = await getDbClient();
  try { await ensurePortalSchema(client); const result = await client.query(`with current_characters as (select id from portal_characters where active=true and fc_membership_status='current'), owned_rows as (select cm.character_id, cm.mount_id from portal_character_mounts cm join current_characters c on c.id=cm.character_id where cm.owned=true) select (select count(*) from current_characters)::int tracked_characters, (select count(*) from portal_mounts)::int total_mounts, (select count(*) from owned_rows)::int owned_count;`); const row=result.rows[0]; const tracked=Number(row.tracked_characters||0), total=Number(row.total_mounts||0), owned=Number(row.owned_count||0), possible=tracked*total; return {tracked_characters:tracked,total_mounts:total,owned_count:owned,total_possible:possible,collection_rate:possible?Number(((owned/possible)*100).toFixed(1)):0}; } finally { await client.end(); }
}

async function getMountCategoryProgress(viewerCharacterId: number | null, hideOwned: boolean): Promise<PortalMountCategoryProgress[]> {
  const client=await getDbClient(); try { await ensurePortalSchema(client); const result=await client.query(`with current_characters as (select id from portal_characters where active=true and fc_membership_status='current'), categorized as (select m.id, ${MOUNT_CATEGORY_CASE_SQL} category_key from portal_mounts m), visible as (select n.id,n.category_key from categorized n left join portal_character_mounts v on v.mount_id=n.id and v.character_id=$1 where $2::boolean=false or $1::bigint is null or coalesce(v.owned,false)=false), counts as (select category_key,count(*)::int mount_count from visible group by category_key), owned as (select n.category_key,count(*) filter(where cm.owned=true)::int owned_count from visible n cross join current_characters c left join portal_character_mounts cm on cm.mount_id=n.id and cm.character_id=c.id group by n.category_key), chars as (select count(*)::int tracked_characters from current_characters) select c.category_key,c.mount_count,coalesce(o.owned_count,0)::int owned_count,chars.tracked_characters from counts c cross join chars left join owned o on o.category_key=c.category_key;`,[viewerCharacterId,hideOwned]); return result.rows.map((row)=>{const key=row.category_key as PortalMountCategoryKey, meta=getMountCategoryMetadata(key); return {category_key:key,category_name:meta.name,sort_order:meta.sortOrder,mount_count:Number(row.mount_count||0),tracked_characters:Number(row.tracked_characters||0),owned_count:Number(row.owned_count||0)};}).sort((a,b)=>a.sort_order-b.sort_order); } finally { await client.end(); }
}

async function getMountAcquisitionCatalog(viewerCharacterId: number | null, categoryKey: string, hideOwned: boolean): Promise<PortalMountAcquisitionCard[]> {
  const client=await getDbClient(); try { await ensurePortalSchema(client); const result=await client.query(`with current_characters as (select id from portal_characters where active=true and fc_membership_status='current'), categorized as (select m.*,${MOUNT_CATEGORY_CASE_SQL} category_key from portal_mounts m), ownership as (select m.id mount_id,count(c.id)::int tracked_characters,count(cm.mount_id) filter(where cm.owned=true)::int fc_owned_count from portal_mounts m cross join current_characters c left join portal_character_mounts cm on cm.mount_id=m.id and cm.character_id=c.id group by m.id) select m.id::int,m.mount_name,m.description,m.source_name,m.acquisition_data,m.patch,m.icon_url,m.image_url,m.ffxiv_collect_mount_id,m.marketboard_item_name,m.category_key,coalesce(v.owned,false) owned_by_viewer,coalesce(o.fc_owned_count,0)::int fc_owned_count,coalesce(o.tracked_characters,0)::int tracked_characters,coalesce(market.listings,'[]'::jsonb) marketboard_listings,case when faerie.world_name is null then null else jsonb_build_object('world_name',faerie.world_name,'data_center_name',faerie.data_center_name,'min_price',faerie.min_price) end marketboard_faerie,count(*) over()::int total_matches from categorized m left join portal_character_mounts v on v.mount_id=m.id and v.character_id=$1 left join ownership o on o.mount_id=m.id left join lateral (select jsonb_agg(jsonb_build_object('world_name',p.world_name,'data_center_name',p.data_center_name,'min_price',p.min_price) order by p.min_price,p.world_name) listings from (select world_name,data_center_name,min_price from portal_marketboard_item_prices where item_id=m.marketboard_item_id and min_price is not null order by min_price,world_name limit 3) p) market on true left join lateral (select world_name,data_center_name,min_price from portal_marketboard_item_prices where item_id=m.marketboard_item_id and lower(world_name)=lower($4) and min_price is not null order by min_price limit 1) faerie on true where ($2::text='' or m.category_key=$2) and ($3::boolean=false or coalesce(v.owned,false)=false) order by lower(m.mount_name) limit 1000;`,[viewerCharacterId,categoryKey,hideOwned,defaultWorld]); return result.rows.map((row)=>{const key=row.category_key as PortalMountCategoryKey, meta=getMountCategoryMetadata(key); const listings=Array.isArray(row.marketboard_listings)?row.marketboard_listings.map((x:Record<string,unknown>)=>({world_name:String(x.world_name||''),data_center_name:x.data_center_name?String(x.data_center_name):null,min_price:Number(x.min_price||0)})):[]; const sources=Array.isArray(row.acquisition_data)?row.acquisition_data:[]; const f=row.marketboard_faerie; return {id:Number(row.id),mount_name:row.mount_name,description:row.description||null,source_name:row.source_name||null,patch:row.patch||null,icon_url:row.icon_url||null,image_url:row.image_url||null,ffxiv_collect_mount_id:row.ffxiv_collect_mount_id||null,marketboard_item_name:row.marketboard_item_name||null,marketboard_listings:listings,marketboard_faerie:f&&typeof f==='object'?{world_name:String(f.world_name||defaultWorld),data_center_name:f.data_center_name?String(f.data_center_name):null,min_price:Number(f.min_price||0)}:null,category_key:key,category_name:meta.name,acquisition_data:sources,owned_by_viewer:row.owned_by_viewer===true,fc_owned_count:Number(row.fc_owned_count||0),tracked_characters:Number(row.tracked_characters||0),total_matches:Number(row.total_matches||0)};}); } finally { await client.end(); }
}
const MINION_CATEGORY_CASE_SQL = `
  case
    when lower(coalesce(n.source_name, '')) like any(array['%tribal:%', '%beast tribe:%']) then 'tribal'
    when lower(coalesce(n.source_name, '')) like '%pvp:%' then 'pvp'
    when lower(coalesce(n.source_name, '')) like '%event:%' then 'event'
    when lower(coalesce(n.source_name, '')) like '%premium:%' then 'premium'
    when lower(coalesce(n.source_name, '')) like '%quest:%' then 'quest'
    when lower(coalesce(n.source_name, '')) like '%purchase:%' then 'vendor'
    when lower(coalesce(n.source_name, '')) like '%achievement:%' then 'achievement'
    when lower(coalesce(n.source_name, '')) like '%gold saucer:%' then 'gold_saucer'
    when lower(coalesce(n.source_name, '')) like '%island sanctuary:%' then 'island_sanctuary'
    when lower(coalesce(n.source_name, '')) like '%gardening%' then 'gardening'
    when lower(coalesce(n.source_name, '')) like any(array['%gathering:%', '%venture:%', '%voyages:%']) then 'gathering'
    when lower(coalesce(n.source_name, '')) like any(array['%crafting:%', '%skybuilders:%', '%cosmic exploration:%', '%scrip%']) then 'crafting'
    when lower(coalesce(n.source_name, '')) like any(array[
      '%dungeon:%', '%raid:%', '%trial:%', '%fate:%', '%treasure hunt:%',
      '%occult crescent:%', '%bozja:%', '%eureka:%', '%hunts:%', '%wondrous tails:%'
    ]) then 'farmable'
    else 'other'
  end
`;

const MINION_CATEGORY_METADATA: Record<PortalMinionCategoryKey, { name: string; sortOrder: number }> = {
  farmable: { name: "Duty / Farmed", sortOrder: 10 },
  gathering: { name: "Gathering / Ventures", sortOrder: 20 },
  gardening: { name: "Gardening", sortOrder: 25 },
  crafting: { name: "Crafting / Scrips", sortOrder: 30 },
  tribal: { name: "Tribal Quests", sortOrder: 40 },
  island_sanctuary: { name: "Island Sanctuary", sortOrder: 45 },
  pvp: { name: "PvP", sortOrder: 50 },
  event: { name: "Seasonal Events", sortOrder: 60 },
  quest: { name: "Quests", sortOrder: 70 },
  vendor: { name: "Vendors", sortOrder: 80 },
  premium: { name: "Premium", sortOrder: 90 },
  achievement: { name: "Achievements", sortOrder: 100 },
  gold_saucer: { name: "Gold Saucer", sortOrder: 110 },
  other: { name: "Other Sources", sortOrder: 120 }
};
function getMinionCategoryMetadata(categoryKey: string) {
  return MINION_CATEGORY_METADATA[categoryKey as PortalMinionCategoryKey] ?? MINION_CATEGORY_METADATA.other;
}

async function getMinionTrackerStats(): Promise<PortalMinionTrackerStats> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      with current_characters as (
        select id from portal_tracked_characters
      ), catalog_minions as (
        select id from portal_minions
      ), owned_rows as (
        select cm.character_id, cm.minion_id
        from portal_character_minions cm
        join current_characters c on c.id = cm.character_id
        join catalog_minions n on n.id = cm.minion_id
        where cm.owned = true
      )
      select
        (select count(*) from current_characters)::int as tracked_characters,
        (select count(*) from catalog_minions)::int as total_minions,
        ((select count(*) from current_characters) * (select count(*) from catalog_minions))::int as total_possible,
        (select count(*) from owned_rows)::int as owned_count;
    `);
    const row = result.rows[0];
    const trackedCharacters = Number(row.tracked_characters ?? 0);
    const totalMinions = Number(row.total_minions ?? 0);
    const totalPossible = Number(row.total_possible ?? 0);
    const ownedCount = Number(row.owned_count ?? 0);
    const missingCount = Math.max(totalPossible - ownedCount, 0);
    return {
      tracked_characters: trackedCharacters,
      total_minions: totalMinions,
      total_possible: totalPossible,
      owned_count: ownedCount,
      missing_count: missingCount,
      collection_rate: totalPossible > 0 ? Number(((ownedCount / totalPossible) * 100).toFixed(1)) : 0
    };
  } finally {
    await client.end();
  }
}

async function getMinionCategoryProgress(
  viewerCharacterId: number | null = null,
  hideOwned = false
): Promise<PortalMinionCategoryProgress[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      with current_characters as (
        select id from portal_tracked_characters
      ), categorized_minions as (
        select n.id, ${MINION_CATEGORY_CASE_SQL} as category_key
        from portal_minions n
      ), category_keys as (
        select distinct category_key from categorized_minions
      ), visible_minions as (
        select n.id, n.category_key
        from categorized_minions n
        left join portal_character_minions viewer
          on viewer.minion_id = n.id
         and viewer.character_id = $1
        where $2::boolean = false
           or $1::bigint is null
           or coalesce(viewer.owned, false) = false
      ), category_counts as (
        select category_key, count(*)::int as minion_count
        from visible_minions
        group by category_key
      ), ownership_counts as (
        select n.category_key, count(*) filter (where cm.owned = true)::int as owned_count
        from visible_minions n
        cross join current_characters c
        left join portal_character_minions cm
          on cm.minion_id = n.id and cm.character_id = c.id
        group by n.category_key
      ), character_count as (
        select count(*)::int as tracked_characters from current_characters
      )
      select keys.category_key, coalesce(cc.minion_count, 0)::int as minion_count,
             ch.tracked_characters,
             (coalesce(cc.minion_count, 0) * ch.tracked_characters)::int as total_possible,
             coalesce(oc.owned_count, 0)::int as owned_count
      from category_keys keys
      cross join character_count ch
      left join category_counts cc on cc.category_key = keys.category_key
      left join ownership_counts oc on oc.category_key = keys.category_key;
    `, [viewerCharacterId, hideOwned]);
    return result.rows.map((row) => {
      const categoryKey = row.category_key as PortalMinionCategoryKey;
      const metadata = getMinionCategoryMetadata(categoryKey);
      const totalPossible = Number(row.total_possible ?? 0);
      const ownedCount = Number(row.owned_count ?? 0);
      return {
        category_key: categoryKey,
        category_name: metadata.name,
        sort_order: metadata.sortOrder,
        minion_count: Number(row.minion_count ?? 0),
        tracked_characters: Number(row.tracked_characters ?? 0),
        total_possible: totalPossible,
        owned_count: ownedCount,
        missing_count: Math.max(totalPossible - ownedCount, 0),
        collection_rate: totalPossible > 0 ? Number(((ownedCount / totalPossible) * 100).toFixed(1)) : 0
      };
    }).sort((a, b) => a.sort_order - b.sort_order);
  } finally {
    await client.end();
  }
}
async function getMostNeededMinions(
  limit = 15,
  categoryKey = ""
): Promise<PortalMostNeededMinion[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      with current_characters as (
        select id from portal_tracked_characters
      ), categorized_minions as (
        select n.id, n.minion_name, n.source_name, n.patch, n.icon_url,
               ${MINION_CATEGORY_CASE_SQL} as category_key
        from portal_minions n
      ), minion_ownership as (
        select n.id as minion_id, n.minion_name, n.source_name, n.patch, n.icon_url, n.category_key,
               count(c.id)::int as tracked_characters,
               count(cm.minion_id) filter (where cm.owned = true)::int as owned_count,
               (count(c.id) - count(cm.minion_id) filter (where cm.owned = true))::int as missing_count
        from categorized_minions n
        cross join current_characters c
        left join portal_character_minions cm
          on cm.minion_id = n.id and cm.character_id = c.id
        where ($2::text = '' or n.category_key = $2::text)
        group by n.id, n.minion_name, n.source_name, n.patch, n.icon_url, n.category_key
      )
      select *, case when tracked_characters > 0
        then round((missing_count::numeric / tracked_characters::numeric) * 100, 1)
        else 0 end as missing_rate
      from minion_ownership
      where missing_count > 0
      order by missing_count desc, lower(minion_name) asc
      limit $1;
    `, [limit, categoryKey]);
    return result.rows.map((row) => {
      const category = getMinionCategoryMetadata(row.category_key);
      return {
        minion_id: Number(row.minion_id),
        minion_name: row.minion_name,
        source_name: row.source_name,
        patch: row.patch,
        icon_url: row.icon_url,
        category_key: row.category_key as PortalMinionCategoryKey,
        category_name: category.name,
        tracked_characters: Number(row.tracked_characters ?? 0),
        owned_count: Number(row.owned_count ?? 0),
        missing_count: Number(row.missing_count ?? 0),
        missing_rate: Number(row.missing_rate ?? 0)
      };
    });
  } finally {
    await client.end();
  }
}

async function getCharacterMinionProgress(
  limit = 150,
  categoryKey = ""
): Promise<PortalCharacterMinionProgress[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      with categorized_minions as (
        select n.id, ${MINION_CATEGORY_CASE_SQL} as category_key
        from portal_minions n
      ), selected_minions as (
        select id from categorized_minions
        where ($2::text = '' or category_key = $2::text)
      )
      select c.id::int as character_id, c.display_name, c.character_name, c.world, c.role,
             c.minion_sync_status as sync_status, c.last_minion_sync_at,
             count(n.id)::int as total_minions,
             count(cm.minion_id) filter (where cm.owned = true)::int as owned_minions,
             (count(n.id) - count(cm.minion_id) filter (where cm.owned = true))::int as missing_minions,
             case when count(n.id) > 0 then round(
               (count(cm.minion_id) filter (where cm.owned = true))::numeric / count(n.id)::numeric * 100, 1
             ) else 0 end as collection_rate
      from portal_characters c
      cross join selected_minions n
      left join portal_character_minions cm
        on cm.character_id = c.id and cm.minion_id = n.id
      where c.id in (select id from portal_tracked_characters)
      group by c.id, c.display_name, c.character_name, c.world, c.role,
               c.minion_sync_status, c.last_minion_sync_at
      order by collection_rate asc, missing_minions desc, lower(c.display_name) asc
      limit $1;
    `, [limit, categoryKey]);
    return result.rows.map((row) => ({
      character_id: Number(row.character_id),
      display_name: row.display_name,
      character_name: row.character_name,
      world: row.world,
      role: row.role,
      sync_status: row.sync_status,
      last_minion_sync_at: row.last_minion_sync_at,
      total_minions: Number(row.total_minions ?? 0),
      owned_minions: Number(row.owned_minions ?? 0),
      missing_minions: Number(row.missing_minions ?? 0),
      collection_rate: Number(row.collection_rate ?? 0)
    }));
  } finally {
    await client.end();
  }
}
async function getMinionAcquisitionCatalog(
  viewerCharacterId: number | null,
  categoryKey = "",
  search = "",
  hideOwned = false,
  limit = 120
): Promise<PortalMinionAcquisitionCard[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      with current_characters as (
        select id from portal_tracked_characters
      ), categorized_minions as (
        select n.*, ${MINION_CATEGORY_CASE_SQL} as category_key
        from portal_minions n
      ), ownership as (
        select n.id as minion_id,
               count(c.id)::int as tracked_characters,
               count(cm.minion_id) filter (where cm.owned = true)::int as fc_owned_count
        from portal_minions n
        cross join current_characters c
        left join portal_character_minions cm
          on cm.minion_id = n.id
         and cm.character_id = c.id
        group by n.id
      )
      select n.id::int, n.minion_name, n.description, n.source_name, n.patch,
             n.icon_url, n.image_url, n.ffxiv_collect_minion_id, n.category_key, n.acquisition_data,
             n.marketboard_item_name,
             coalesce(market.listings, '[]'::jsonb) as marketboard_listings,
             case when faerie.world_name is null then null else jsonb_build_object(
               'world_name', faerie.world_name,
               'data_center_name', faerie.data_center_name,
               'min_price', faerie.min_price
             ) end as marketboard_faerie,
             coalesce(viewer.owned, false) as owned_by_viewer,
             coalesce(o.fc_owned_count, 0)::int as fc_owned_count,
             coalesce(o.tracked_characters, 0)::int as tracked_characters,
             count(*) over()::int as total_matches
      from categorized_minions n
      left join portal_character_minions viewer
        on viewer.minion_id = n.id
       and viewer.character_id = $1
      left join ownership o on o.minion_id = n.id
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'world_name', cheapest.world_name,
            'data_center_name', cheapest.data_center_name,
            'min_price', cheapest.min_price
          ) order by cheapest.min_price asc, cheapest.world_name asc
        ) as listings
        from (
          select p.world_name, p.data_center_name, p.min_price
          from portal_marketboard_minion_prices p
          where p.item_id = n.marketboard_item_id
            and p.min_price is not null
          order by p.min_price asc, p.world_name asc
          limit 3
        ) cheapest
      ) market on true
      left join lateral (
        select p.world_name, p.data_center_name, p.min_price
        from portal_marketboard_minion_prices p
        where p.item_id = n.marketboard_item_id
          and lower(p.world_name) = lower($6)
          and p.min_price is not null
        order by p.min_price asc
        limit 1
      ) faerie on true
      where ($2::text = '' or n.category_key = $2::text)
        and ($4::boolean = false or coalesce(viewer.owned, false) = false)
        and (
          $3::text = ''
          or lower(n.minion_name) like '%' || lower($3::text) || '%'
          or lower(coalesce(n.source_name, '')) like '%' || lower($3::text) || '%'
          or lower(coalesce(n.description, '')) like '%' || lower($3::text) || '%'
        )
      order by lower(n.minion_name)
      limit $5;`,
      [viewerCharacterId, categoryKey, search, hideOwned, limit, defaultWorld]
    );

    return result.rows.map((row) => {
      let acquisitionData: PortalMinionAcquisitionSource[] = [];
      try {
        const parsed = typeof row.acquisition_data === "string"
          ? JSON.parse(row.acquisition_data)
          : row.acquisition_data;
        acquisitionData = Array.isArray(parsed) ? parsed : [];
      } catch {
        acquisitionData = [];
      }
      const metadata = getMinionCategoryMetadata(row.category_key);
      const marketboardListings = Array.isArray(row.marketboard_listings)
        ? row.marketboard_listings.map((listing: Record<string, unknown>) => ({
            world_name: String(listing.world_name ?? ""),
            data_center_name: listing.data_center_name ? String(listing.data_center_name) : null,
            min_price: Number(listing.min_price ?? 0)
          }))
        : [];
      const marketboardFaerie = row.marketboard_faerie && typeof row.marketboard_faerie === "object"
        ? {
            world_name: String(row.marketboard_faerie.world_name ?? defaultWorld),
            data_center_name: row.marketboard_faerie.data_center_name ? String(row.marketboard_faerie.data_center_name) : null,
            min_price: Number(row.marketboard_faerie.min_price ?? 0)
          }
        : null;
      return {
        id: Number(row.id),
        minion_name: row.minion_name,
        description: row.description ?? null,
        source_name: row.source_name ?? null,
        patch: row.patch ?? null,
        icon_url: row.icon_url ?? null,
        image_url: row.image_url ?? null,
        ffxiv_collect_minion_id: row.ffxiv_collect_minion_id ?? null,
        marketboard_item_name: row.marketboard_item_name ?? null,
        marketboard_listings: marketboardListings,
        marketboard_faerie: marketboardFaerie,
        category_key: row.category_key as PortalMinionCategoryKey,
        category_name: metadata.name,
        acquisition_data: acquisitionData,
        owned_by_viewer: row.owned_by_viewer === true,
        fc_owned_count: Number(row.fc_owned_count ?? 0),
        tracked_characters: Number(row.tracked_characters ?? 0),
        total_matches: Number(row.total_matches ?? 0)
      };
    });
  } finally {
    await client.end();
  }
}
async function getMarketboardMounts(viewerCharacterId: number | null) {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      select m.id::int, m.mount_name, m.marketboard_item_name, m.icon_url, m.source_name, coalesce(viewer_mount.owned, false) as owned_by_viewer,
             p.world_name, p.data_center_name, p.min_price, p.updated_at
      from portal_mounts m
      join portal_marketboard_item_prices p on p.item_id = m.marketboard_item_id
      left join portal_character_mounts viewer_mount on viewer_mount.mount_id = m.id and viewer_mount.character_id = $1
      where m.marketboard_eligible = true and m.marketboard_item_id is not null
      order by m.id, p.min_price asc nulls last, p.world_name;`, [viewerCharacterId]);
    const grouped = new Map();
    for (const row of result.rows) {
      if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, mount_name: row.mount_name, marketboard_item_name: row.marketboard_item_name, icon_url: row.icon_url, source_name: row.source_name, owned_by_viewer: row.owned_by_viewer === true, listings: [], faerie: null });
      const mount = grouped.get(row.id);
      const listing = { world_name: row.world_name, data_center_name: row.data_center_name, min_price: row.min_price };
      if (String(row.world_name).toLowerCase() === defaultWorld.toLowerCase()) mount.faerie = listing;
      if (mount.listings.length < 3) mount.listings.push(listing);
    }
    return [...grouped.values()].sort((a, b) => Number(a.listings[0]?.min_price ?? 0) - Number(b.listings[0]?.min_price ?? 0));
  } finally { await client.end(); }
}
async function getMarketboardMinions(viewerCharacterId: number | null) {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      select n.id::int, n.minion_name, n.marketboard_item_name, n.icon_url, n.source_name,
             coalesce(viewer_minion.owned, false) as owned_by_viewer,
             p.world_name, p.data_center_name, p.min_price
        from portal_minions n
        join portal_marketboard_minion_prices p on p.item_id = n.marketboard_item_id
        left join portal_character_minions viewer_minion
          on viewer_minion.minion_id = n.id
         and viewer_minion.character_id = $1
       where n.marketboard_eligible = true
         and n.marketboard_item_id is not null
       order by n.id, p.min_price asc nulls last, p.world_name;`,
      [viewerCharacterId]
    );
    const grouped = new Map();
    for (const row of result.rows) {
      if (!grouped.has(row.id)) {
        grouped.set(row.id, {
          id: row.id,
          minion_name: row.minion_name,
          marketboard_item_name: row.marketboard_item_name,
          icon_url: row.icon_url,
          source_name: row.source_name,
          owned_by_viewer: row.owned_by_viewer === true,
          listings: [],
          faerie: null
        });
      }
      const minion = grouped.get(row.id);
      const listing = {
        world_name: row.world_name,
        data_center_name: row.data_center_name,
        min_price: row.min_price
      };
      if (String(row.world_name).toLowerCase() === defaultWorld.toLowerCase()) minion.faerie = listing;
      if (minion.listings.length < 3) minion.listings.push(listing);
    }
    return [...grouped.values()].sort(
      (a, b) => Number(a.listings[0]?.min_price ?? 0) - Number(b.listings[0]?.min_price ?? 0)
    );
  } finally {
    await client.end();
  }
}async function getCharacterMountDetails(
  characterId: number,
  mountSetId?: number
): Promise<PortalCharacterMountDetails | null> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

  const selectedMountSetId =
      Number.isFinite(mountSetId) && mountSetId && mountSetId > 0
        ? mountSetId
        : null;

    const characterResult = await client.query(
      `
        select
          id::int as character_id,
          display_name,
          character_name,
          world,
          role,
          sync_status,
          last_mount_sync_at
        from portal_characters
        where id = $1
          and active = true
          and id in (select id from portal_tracked_characters)
        limit 1;
      `,
      [characterId]
    );

    if (characterResult.rows.length === 0) {
      return null;
    }

    const character = characterResult.rows[0];

    const mountResult = await client.query(
      `
        select
          ms.id::int as set_id,
          ms.name as set_name,
          ms.expansion,
          ms.sort_order as set_sort_order,
          m.id::int as mount_id,
          m.mount_name,
          m.source_name,
          m.patch,
          m.icon_url,
          m.sort_order as mount_sort_order,
          coalesce(cm.owned, false) as owned
        from portal_mounts m
        join portal_mount_sets ms on ms.id = m.mount_set_id
        left join portal_character_mounts cm
          on cm.mount_id = m.id
         and cm.character_id = $1
        where m.active = true
          and ms.active = true
          and ($2::bigint is null or m.mount_set_id = $2::bigint)
        order by
          ms.sort_order asc,
          lower(ms.name) asc,
          m.sort_order asc,
          lower(m.mount_name) asc;
      `,
      [characterId, selectedMountSetId]
    );

    const setMap = new Map<number, PortalCharacterMountDetailSet>();

    for (const row of mountResult.rows) {
      const setId = Number(row.set_id);

      if (!setMap.has(setId)) {
        setMap.set(setId, {
          id: setId,
          name: row.set_name,
          expansion: row.expansion,
          sort_order: Number(row.set_sort_order),
          total_mounts: 0,
          owned_mounts: 0,
          missing_mounts: 0,
          collection_rate: 0,
          mounts: []
        });
      }

      const mountSet = setMap.get(setId)!;
      const owned = Boolean(row.owned);

      mountSet.total_mounts += 1;

      if (owned) {
        mountSet.owned_mounts += 1;
      } else {
        mountSet.missing_mounts += 1;
      }

      mountSet.mounts.push({
        id: Number(row.mount_id),
        mount_name: row.mount_name,
        source_name: row.source_name,
        patch: row.patch,
        icon_url: row.icon_url,
        owned
      });
    }

    const sets = Array.from(setMap.values()).map((mountSet) => ({
      ...mountSet,
      collection_rate:
        mountSet.total_mounts > 0
          ? Number(((mountSet.owned_mounts / mountSet.total_mounts) * 100).toFixed(1))
          : 0
    }));

    return {
      character_id: Number(character.character_id),
      display_name: character.display_name,
      character_name: character.character_name,
      world: character.world,
      role: character.role,
      sync_status: character.sync_status,
      last_mount_sync_at: character.last_mount_sync_at,
      sets
    };
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05K: Database health read
// -------------------------

async function getDatabaseStatus() {
  try {
    const client = await getDbClient();

    try {
      await ensurePortalSchema(client);
      const result = await client.query("select now() as now");

      return {
        ok: true,
        message: `Database online · ${formatShortDateTime(String(result.rows[0].now))}`
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Database check failed"
    };
  }
}

// -------------------------
// SUBSECTION 05L: Join date manager reads
// -------------------------

async function getJoinDateCharacters(): Promise<PortalJoinDateCharacter[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(`
      select
        id::int,
        display_name,
        character_name,
        world,
        role,
        first_seen_in_fc_at,
        last_seen_in_fc_at,
        join_date_override,
        join_date_source
      from portal_characters
      where active = true
        and fc_membership_status = 'current'
      order by lower(display_name) asc;
    `);

    return result.rows.map((row) => ({
      id: Number(row.id),
      display_name: row.display_name,
      character_name: row.character_name,
      world: row.world,
      role: row.role,
      first_seen_in_fc_at: row.first_seen_in_fc_at,
      last_seen_in_fc_at: row.last_seen_in_fc_at,
      join_date_override: row.join_date_override,
      join_date_source: row.join_date_source
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05M: Discord automation reads
// -------------------------

async function getDiscordLinks(limit = 100): Promise<PortalDiscordLink[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          dl.discord_user_id,
          dl.discord_username,
          dl.discord_global_name,
          dl.discord_nickname,
          dl.discord_display_name,
          dl.character_id::int,
          c.character_name,
          c.world,
          c.role,
          dl.match_source,
          dl.matched_at,
          dl.last_seen_at
        from portal_discord_links dl
        left join portal_characters c
          on c.id = dl.character_id
        order by dl.updated_at desc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      discord_user_id: row.discord_user_id,
      discord_username: row.discord_username,
      discord_global_name: row.discord_global_name,
      discord_nickname: row.discord_nickname,
      discord_display_name: row.discord_display_name,
      character_id: row.character_id === null ? null : Number(row.character_id),
      character_name: row.character_name,
      world: row.world,
      role: row.role,
      match_source: row.match_source,
      matched_at: row.matched_at,
      last_seen_at: row.last_seen_at
    }));
  } finally {
    await client.end();
  }
}

async function getDiscordAuditLogs(limit = 100): Promise<PortalDiscordAuditLog[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          log.id::int,
          log.discord_user_id,
          log.discord_username,
          log.discord_global_name,
          log.discord_nickname,
          log.discord_display_name,
          log.submitted_character_name,
          log.character_id::int,
          c.character_name,
          log.attempt_type,
          log.result,
          log.reason,
          log.created_at
        from portal_discord_audit_log log
        left join portal_characters c
          on c.id = log.character_id
        order by log.created_at desc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      discord_user_id: row.discord_user_id,
      discord_username: row.discord_username,
      discord_global_name: row.discord_global_name,
      discord_nickname: row.discord_nickname,
      discord_display_name: row.discord_display_name,
      submitted_character_name: row.submitted_character_name,
      character_id: row.character_id === null ? null : Number(row.character_id),
      character_name: row.character_name,
      attempt_type: row.attempt_type,
      result: row.result,
      reason: row.reason,
      created_at: row.created_at
    }));
  } finally {
    await client.end();
  }
}

// -------------------------

async function getCharacterRenameReviews(limit = 100): Promise<PortalCharacterRenameReview[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(
      `
        select h.id::int, h.character_id::int, h.old_name, h.new_name, h.detected_at,
               h.notification_status, h.confirmation_status, h.confirmed_at,
               c.character_name, c.display_name, c.portrait_url, dl.discord_user_id
        from portal_character_rename_history h
        join portal_characters c on c.id = h.character_id
        left join portal_discord_links dl on dl.character_id = c.id
        order by h.detected_at desc, h.id desc
        limit $1;
      `,
      [limit]
    );
    return result.rows.map((row) => ({
      id: Number(row.id), character_id: Number(row.character_id), old_name: row.old_name,
      new_name: row.new_name, detected_at: row.detected_at,
      notification_status: row.notification_status, confirmation_status: row.confirmation_status,
      confirmed_at: row.confirmed_at, character_name: row.character_name,
      display_name: row.display_name, portrait_url: row.portrait_url,
      discord_user_id: row.discord_user_id
    }));
  } finally {
    await client.end();
  }
}
// SUBSECTION 05N: Discord bot settings read
// -------------------------

async function getDiscordBotSettings(): Promise<PortalDiscordBotSettings> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(`
      select
        guild_id,
        verified_role_id,
        unverified_role_id,
        temp_access_role_id,
        temporary_guest_enabled,
        onboarding_selection_minutes,
        temp_guest_hours,
        welcome_channel_id,
        free_company_chat_channel_id,
        welcome_engagement_enabled,
        welcome_wave_sticker_ids,
        officer_log_channel_id,
        event_channel_id,
        raid_channel_id,
        mount_farm_channel_id,
        mount_win_channel_id,
        mount_win_announcements_enabled,
        anime_event_scheduling_enabled,
        crafting_channel_id,
        treasure_map_channel_id,
        treasure_map_auto_enabled,
        roster_review_channel_id,
        test_channel_id,
        member_rename_notification_channel_id,
        gaming_setups_channel_id,
        pets_gallery_channel_id,
        glamours_gallery_channel_id,
        artwork_gallery_channel_id,
        giveaway_channel_id,
        contestants_channel_id,
        fashion_report_channel_id,
        fashion_report_enabled,
        anime_ranking_channel_id,
        anime_ranking_enabled,
        anime_ranking_thread_enabled,
        lodestone_news_channel_id,
        lodestone_news_enabled,
        notification_window_enabled,
        notification_window_start_time,
        notification_window_end_time,
        rename_notifications_discord_members_enabled,
        rename_notifications_non_discord_members_enabled,
        auto_rename_enabled,
        auto_role_enabled,
        startup_member_sync_enabled,
        log_unmatched_attempts,
        auto_roster_scan_enabled,
        roster_scan_interval_hours,
        alt_character_claims_enabled,
        alt_character_default_limit,
        alt_character_verification_mode,
        alt_character_code_expiry_minutes
      from portal_discord_bot_settings
      where id = 1;
    `);

    const row = result.rows[0];

    return {
      guild_id: row?.guild_id || String(process.env.DISCORD_GUILD_ID || ""),
      verified_role_id: row?.verified_role_id || String(process.env.DISCORD_VERIFIED_ROLE_ID || ""),
      unverified_role_id: row?.unverified_role_id || String(process.env.DISCORD_UNVERIFIED_ROLE_ID || ""),
      temp_access_role_id: row?.temp_access_role_id || String(process.env.DISCORD_TEMP_ACCESS_ROLE_ID || ""),
      temporary_guest_enabled: typeof row?.temporary_guest_enabled === "boolean"
        ? row.temporary_guest_enabled
        : String(process.env.DISCORD_TEMP_GUEST_ENABLED || "").toLowerCase() === "true",
      onboarding_selection_minutes: Number(row?.onboarding_selection_minutes ?? 30),
      temp_guest_hours: Number(
        typeof row?.temporary_guest_enabled === "boolean"
          ? row?.temp_guest_hours ?? 6
          : process.env.DISCORD_TEMP_GUEST_HOURS || row?.temp_guest_hours || 6
      ),
      welcome_channel_id: row?.welcome_channel_id || String(process.env.DISCORD_WELCOME_CHANNEL_ID || ""),
      free_company_chat_channel_id: row?.free_company_chat_channel_id || String(process.env.DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID || ""),
      welcome_engagement_enabled: typeof row?.welcome_engagement_enabled === "boolean"
        ? row.welcome_engagement_enabled
        : ["1", "true", "yes", "on"].includes(String(process.env.DISCORD_WELCOME_ENGAGEMENT_ENABLED || "false").toLowerCase()),
      welcome_wave_sticker_ids: row
        ? String(row.welcome_wave_sticker_ids ?? "")
        : String(process.env.DISCORD_WELCOME_WAVE_STICKER_IDS ?? defaultWelcomeWaveStickerIds),
      officer_log_channel_id: row?.officer_log_channel_id || String(process.env.DISCORD_OFFICER_LOG_CHANNEL_ID || ""),
      event_channel_id: row?.event_channel_id || String(process.env.DISCORD_RAID_CHANNEL_ID || process.env.DISCORD_EVENT_CHANNEL_ID || ""),
      raid_channel_id: "",
      mount_farm_channel_id: "",
      mount_win_channel_id: row?.mount_win_channel_id || String(process.env.DISCORD_MOUNT_WIN_CHANNEL_ID || ""),
      mount_win_announcements_enabled:
        typeof row?.mount_win_announcements_enabled === "boolean" ? row.mount_win_announcements_enabled : true,
      anime_event_scheduling_enabled:
        typeof row?.anime_event_scheduling_enabled === "boolean"
          ? row.anime_event_scheduling_enabled
          : ["1", "true", "yes", "on"].includes(String(process.env.ANIME_DISCORD_ENABLED || "false").toLowerCase()),
      crafting_channel_id: row?.crafting_channel_id || "",
      treasure_map_channel_id: row?.treasure_map_channel_id || "",
      treasure_map_auto_enabled: Boolean(row?.treasure_map_auto_enabled),
      roster_review_channel_id: row?.roster_review_channel_id || "",
      test_channel_id: row?.test_channel_id || String(process.env.DISCORD_TEST_CHANNEL_ID || ""),
      member_rename_notification_channel_id: row?.member_rename_notification_channel_id || "",
      gaming_setups_channel_id: row?.gaming_setups_channel_id || "",
      pets_gallery_channel_id: row?.pets_gallery_channel_id || "",
      glamours_gallery_channel_id: row?.glamours_gallery_channel_id || "",
      artwork_gallery_channel_id: row?.artwork_gallery_channel_id || "",
      giveaway_channel_id: row?.giveaway_channel_id || "",
      contestants_channel_id: row?.contestants_channel_id || "",
      fashion_report_channel_id: row?.fashion_report_channel_id || "",
      fashion_report_enabled: Boolean(row?.fashion_report_enabled),
      anime_ranking_channel_id: row?.anime_ranking_channel_id || "",
      anime_ranking_enabled: Boolean(row?.anime_ranking_enabled),
      anime_ranking_thread_enabled:
        typeof row?.anime_ranking_thread_enabled === "boolean" ? row.anime_ranking_thread_enabled : true,
      lodestone_news_channel_id: row?.lodestone_news_channel_id || "",
      lodestone_news_enabled: Boolean(row?.lodestone_news_enabled),
      notification_window_enabled: Boolean(row?.notification_window_enabled),
      notification_window_start_time: row?.notification_window_start_time || "08:00",
      notification_window_end_time: row?.notification_window_end_time || "22:00",
      rename_notifications_discord_members_enabled:
        typeof row?.rename_notifications_discord_members_enabled === "boolean"
          ? row.rename_notifications_discord_members_enabled
          : true,
      rename_notifications_non_discord_members_enabled:
        typeof row?.rename_notifications_non_discord_members_enabled === "boolean"
          ? row.rename_notifications_non_discord_members_enabled
          : true,
      auto_rename_enabled: Boolean(row?.auto_rename_enabled),
      auto_role_enabled: Boolean(row?.auto_role_enabled),
      startup_member_sync_enabled: Boolean(row?.startup_member_sync_enabled),
      log_unmatched_attempts: Boolean(row?.log_unmatched_attempts),
      auto_roster_scan_enabled: Boolean(row.auto_roster_scan_enabled),
      roster_scan_interval_hours: Number(row.roster_scan_interval_hours ?? 24),
      alt_character_claims_enabled: Boolean(row.alt_character_claims_enabled),
      alt_character_default_limit: Number(row.alt_character_default_limit ?? 1),
      alt_character_verification_mode: String(row.alt_character_verification_mode || "code_or_officer"),
      alt_character_code_expiry_minutes: Number(row.alt_character_code_expiry_minutes ?? 60)
    };
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05O: Discord roster review read
// -------------------------

async function getDiscordRosterReviews(limit = 100): Promise<PortalDiscordRosterReview[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          dl.discord_user_id,
          dl.discord_username,
          dl.discord_global_name,
          dl.discord_nickname,
          dl.discord_display_name,
          dl.character_id::int,
          c.character_name,
          c.world,
          c.role,
          c.active,
          c.fc_membership_status,
          c.last_seen_in_fc_at,
          dl.matched_at,
          dl.last_seen_at,
          rd.decision as review_decision,
          rd.note as review_note,
          rd.decided_at as review_decided_at,
          rd.decided_by as review_decided_by,
          case
            when c.id is null then 'Linked character no longer exists in the portal database.'
            when c.active = false then 'Linked character is inactive in the portal.'
            when c.fc_membership_status is distinct from 'current' then 'Linked character is no longer marked as a current FC member.'
            else 'Review recommended.'
          end as review_reason
        from portal_discord_links dl
        join portal_discord_member_snapshots s
          on s.discord_user_id = dl.discord_user_id
        left join portal_characters c
          on c.id = dl.character_id
        left join portal_discord_roster_review_decisions rd
          on rd.discord_user_id = dl.discord_user_id
        where s.present_in_guild = true
          and s.has_verified_role = true
          and (
            c.id is null
            or c.active = false
            or c.fc_membership_status is distinct from 'current'
          )
        order by
          dl.updated_at desc,
          dl.last_seen_at desc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      discord_user_id: row.discord_user_id,
      discord_username: row.discord_username,
      discord_global_name: row.discord_global_name,
      discord_nickname: row.discord_nickname,
      discord_display_name: row.discord_display_name,
      character_id: row.character_id === null ? null : Number(row.character_id),
      character_name: row.character_name,
      world: row.world,
      role: row.role,
      active: row.active === null ? null : Boolean(row.active),
      fc_membership_status: row.fc_membership_status,
      last_seen_in_fc_at: row.last_seen_in_fc_at,
      matched_at: row.matched_at,
      last_seen_at: row.last_seen_at,
      review_reason: row.review_reason,
      review_decision: row.review_decision,
      review_note: row.review_note,
      review_decided_at: row.review_decided_at,
      review_decided_by: row.review_decided_by,
    }));
  } finally {
    await client.end();
  }
}

// -------------------------
// SUBSECTION 05P: Discord action queue reads
// -------------------------

async function getDiscordActionQueueStats(): Promise<PortalDiscordQueueStats> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(`
      select
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status = 'needs_confirmation')::int as needs_confirmation,
        count(*) filter (where status = 'processing')::int as processing,
        count(*) filter (where status = 'failed')::int as failed,
        count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status = 'cancelled')::int as cancelled,
        count(*) filter (
          where status in ('pending', 'needs_confirmation', 'processing', 'failed')
        )::int as total_open
      from portal_discord_action_queue;
    `);

    const row = result.rows[0];

    return {
      pending: Number(row.pending ?? 0),
      needs_confirmation: Number(row.needs_confirmation ?? 0),
      processing: Number(row.processing ?? 0),
      failed: Number(row.failed ?? 0),
      completed: Number(row.completed ?? 0),
      cancelled: Number(row.cancelled ?? 0),
      total_open: Number(row.total_open ?? 0)
    };
  } finally {
    await client.end();
  }
}

async function getDiscordRosterScanStatus(
  settings: PortalDiscordBotSettings | null
): Promise<PortalDiscordRosterScanStatus> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(`
      select
        requested_at as last_requested_at,
        completed_at as last_completed_at,
        status as last_status,
        requested_by as last_requested_by,
        result_message as last_result_message,
        error_message as last_error_message
      from portal_discord_action_queue
      where action_type = 'scan_discord_roster'
      order by requested_at desc
      limit 1;
    `);

    const row = result.rows[0] || null;

    const intervalHours = Math.max(
      1,
      Math.min(168, Number(settings?.roster_scan_interval_hours ?? 24))
    );

    const lastRequestedDate = row?.last_requested_at
      ? new Date(row.last_requested_at)
      : null;

    const nextDueDate =
      settings?.auto_roster_scan_enabled
        ? lastRequestedDate
          ? new Date(lastRequestedDate.getTime() + intervalHours * 60 * 60 * 1000)
          : new Date()
        : null;

    return {
      last_requested_at: lastRequestedDate ? lastRequestedDate.toISOString() : null,
      last_completed_at: row?.last_completed_at
        ? new Date(row.last_completed_at).toISOString()
        : null,
      last_status: row?.last_status || null,
      last_requested_by: row?.last_requested_by || null,
      last_result_message: row?.last_result_message || null,
      last_error_message: row?.last_error_message || null,
      next_due_at: nextDueDate ? nextDueDate.toISOString() : null
    };
  } finally {
    await client.end();
  }
}

async function getDiscordScheduledPosts(limit = 50): Promise<PortalDiscordScheduledPost[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          id::int,
          post_type,
          title,
          message,
          embed_image_url,
                    thumbnail_image_url,
          target_channel_kind,
          target_channel_id,
          scheduled_for,
          status,
          created_by,
          created_at,
          updated_at,
          sent_at,
          sent_message_id,
          error_message,
          cancelled_at,
          cancelled_by,
          event_id::int,
          reminder_offset_minutes
        from portal_discord_scheduled_posts
        order by
          case
            when status = 'scheduled' then 0
            when status = 'failed' then 1
            when status = 'sent' then 2
            when status = 'cancelled' then 3
            else 4
          end,
          scheduled_for asc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      post_type: row.post_type,
      title: row.title,
      message: row.message,
      embed_image_url: row.embed_image_url,
          thumbnail_image_url: row.thumbnail_image_url,
      target_channel_kind: row.target_channel_kind,
      target_channel_id: row.target_channel_id,
      scheduled_for: row.scheduled_for,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sent_at: row.sent_at,
      sent_message_id: row.sent_message_id,
      error_message: row.error_message,
      cancelled_at: row.cancelled_at,
      cancelled_by: row.cancelled_by,
      event_id: row.event_id === null ? null : Number(row.event_id),
      reminder_offset_minutes: row.reminder_offset_minutes === null ? null : Number(row.reminder_offset_minutes)
    }));
  } finally {
    await client.end();
  }
}

async function getDiscordEvents(limit = 50): Promise<PortalDiscordEvent[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          id::int,
          event_type,
          title,
          description,
          level,
          level_max,
          event_time_zone,
                duty_id::int,
          duty_name,
          duty_image_url,
          target_channel_kind,
          target_channel_id,
          event_starts_at,
          event_ends_at,
          announcement_post_at,
          announcement_scheduled_post_id::int,
          party_strategy,
          party_size,
          standard_party_roles_required,
          check_in_required,
          roster_locked,
          series_id::int,
          series_occurrence_number,
          (select s.series_name from portal_discord_event_series s where s.id = portal_discord_events.series_id) as series_name,
          (
            select em.mount_id::int
            from portal_discord_event_mounts em
            where em.event_id = portal_discord_events.id
            order by em.sort_order asc, em.mount_id asc
            limit 1
          ) as mount_id,
          reminder_24h_enabled,
          reminder_1h_enabled,
          last_edited_at,
          last_edited_by,
          status,
          created_by,
          created_at,
          updated_at,
          cancelled_at,
          cancelled_by,
          expired_at,
          archived_at,
          archived_by
        from portal_discord_events
        where status <> 'archived'
        order by
          case
            when status = 'planned' then 0
            when status = 'expired' then 1
            when status = 'cancelled' then 2
            else 3
          end,
          event_starts_at asc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      event_type: row.event_type,
      title: row.title,
      description: row.description,
      level: row.level === null ? null : Number(row.level),
      level_max: row.level_max === null ? null : Number(row.level_max),
      event_time_zone: isSupportedMemberEventTimeZone(String(row.event_time_zone)) ? String(row.event_time_zone) : portalTimeZone,
           duty_id: row.duty_id === null ? null : Number(row.duty_id),
      duty_name: row.duty_name,
      duty_image_url: row.duty_image_url,
      target_channel_kind: row.target_channel_kind,
      target_channel_id: row.target_channel_id,
      event_starts_at: row.event_starts_at,
      event_ends_at: row.event_ends_at,
      announcement_post_at: row.announcement_post_at,
      announcement_scheduled_post_id:
        row.announcement_scheduled_post_id === null
          ? null
          : Number(row.announcement_scheduled_post_id),
      party_strategy: row.party_strategy || "rotation",
      party_size: Number(row.party_size || 8),
      standard_party_roles_required: row.standard_party_roles_required !== false,
      check_in_required: row.check_in_required === true,
      roster_locked: Boolean(row.roster_locked),
      series_id: row.series_id === null ? null : Number(row.series_id),
      series_name: row.series_name,
      series_occurrence_number: row.series_occurrence_number === null ? null : Number(row.series_occurrence_number),
      mount_id: row.mount_id === null ? null : Number(row.mount_id),
      reminder_24h_enabled: Boolean(row.reminder_24h_enabled),
      reminder_1h_enabled: Boolean(row.reminder_1h_enabled),
      last_edited_at: row.last_edited_at,
      last_edited_by: row.last_edited_by,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cancelled_at: row.cancelled_at,
      cancelled_by: row.cancelled_by,
      expired_at: row.expired_at,
      archived_at: row.archived_at,
      archived_by: row.archived_by
    }));
  } finally {
    await client.end();
  }
}

async function getMemberEvents(
  character: PortalEligibleMemberCharacter | null,
  limit = 50,
  discordUserId = ""
): Promise<PortalMemberEventsData> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const eventResult = await client.query(
      `select id::int, event_type, title, description, level, level_max, event_time_zone, duty_id::int,
              duty_name, duty_image_url,
              (
                select em.mount_id::int
                from portal_discord_event_mounts em
                where em.event_id = portal_discord_events.id
                order by em.sort_order asc, em.mount_id asc
                limit 1
              ) as mount_id,
              (
                select m.mount_name
                from portal_discord_event_mounts em
                join portal_mounts m on m.id = em.mount_id
                where em.event_id = portal_discord_events.id
                order by em.sort_order asc, m.id asc
                limit 1
              ) as mount_name,
              (
                select m.source_name
                from portal_discord_event_mounts em
                join portal_mounts m on m.id = em.mount_id
                where em.event_id = portal_discord_events.id
                order by em.sort_order asc, m.id asc
                limit 1
              ) as mount_source_name,
              (
                select coalesce(m.image_url, m.icon_url)
                from portal_discord_event_mounts em
                join portal_mounts m on m.id = em.mount_id
                where em.event_id = portal_discord_events.id
                order by em.sort_order asc, m.id asc
                limit 1
              ) as mount_image_url,
              target_channel_kind, target_channel_id,
              event_starts_at, event_ends_at, announcement_post_at,
              announcement_scheduled_post_id::int, party_strategy, party_size, standard_party_roles_required, check_in_required, roster_locked,
              series_id::int, series_occurrence_number,
              (select s.series_name from portal_discord_event_series s where s.id = portal_discord_events.series_id) as series_name,
              reminder_24h_enabled, reminder_1h_enabled, last_edited_at, last_edited_by, status, created_by, created_at,
              updated_at, cancelled_at, cancelled_by, expired_at, archived_at, archived_by
       from portal_discord_events
       where (status = 'planned' and event_starts_at >= now() - interval '6 hours')
          or (status in ('expired', 'archived') and cancelled_at is null and event_starts_at >= now() - interval '90 days')
       order by
         case when status = 'planned' then 0 else 1 end,
         case when status = 'planned' then event_starts_at end asc,
         event_starts_at desc
       limit $1;`,
      [limit]
    );

    const missingLevelDutyNames = eventResult.rows
      .filter((row) => row.level === null && row.mount_source_name)
      .map((row) => getDutyNameFromMountSource(row.mount_source_name))
      .filter(Boolean);
    const normalizedMissingLevelNames = missingLevelDutyNames
      .map((name) => normalizeDutyLookupName(name))
      .filter((name, index, names) => name && names.indexOf(name) === index);
    const fallbackLevelResult = normalizedMissingLevelNames.length > 0
      ? await client.query(
          `select name, level
           from portal_discord_duties
           where active = true
             and level is not null
             and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = any($1::text[])
           order by sort_order asc, lower(name) asc;`,
          [normalizedMissingLevelNames]
        )
      : { rows: [] };
    const fallbackLevelsByDutyName = new Map<string, number>();
    for (const row of fallbackLevelResult.rows) {
      const normalizedName = normalizeDutyLookupName(row.name);
      if (!fallbackLevelsByDutyName.has(normalizedName)) {
        fallbackLevelsByDutyName.set(normalizedName, Number(row.level));
      }
    }

    const memberCharacterIds=new Set<number>();
    if(discordUserId){
      const owned=await client.query(`select dl.character_id::int from portal_discord_links dl where dl.discord_user_id=$1
        union select acl.character_id::int from portal_alt_character_links acl where acl.discord_user_id=$1 and acl.active=true`,[discordUserId]);
      for(const row of owned.rows)memberCharacterIds.add(Number(row.character_id));
    }else if(character)memberCharacterIds.add(character.id);
    const eventIds = eventResult.rows.map((row) => Number(row.id));
    const signupResult = eventIds.length > 0
      ? await client.query(
          `select s.event_id::int, s.character_id::int, c.character_name, c.world,
                  s.signup_status, s.role_preference, s.secondary_role_preference, s.notes, s.roster_state, s.party_number,
                  s.completed_at, s.completed_by, s.attendance_status, s.checked_in_at,
                  s.attendance_updated_at, s.attendance_updated_by, s.created_at, s.updated_at,
                  case
                    when target.mount_id is null then null
                    else not coalesce(cm.owned, false)
                  end as needs_target_mount
           from portal_discord_event_signups s
           join portal_characters c on c.id = s.character_id
           left join lateral (
             select em.mount_id
             from portal_discord_event_mounts em
             where em.event_id = s.event_id
             order by em.sort_order asc, em.mount_id asc
             limit 1
           ) target on true
           left join portal_character_mounts cm
             on cm.character_id = s.character_id and cm.mount_id = target.mount_id
           where s.event_id = any($1::bigint[])
           order by case s.signup_status when 'going' then 0 when 'maybe' then 1 else 2 end,
                    lower(c.character_name) asc;`,
          [eventIds]
        )
      : { rows: [] };

    const suggestionResult = eventIds.length > 0
      ? await client.query(
          `select ranked.event_id::int, ranked.mount_id::int, ranked.mount_name,
                  ranked.source_name, ranked.need_count::int
           from (
             select e.id as event_id, m.id as mount_id, m.mount_name, m.source_name,
                    count(*)::int as need_count,
                    row_number() over (
                      partition by e.id
                      order by source_duty.level asc, count(*) desc, lower(m.mount_name) asc
                    ) as suggestion_rank
             from portal_discord_events e
             join portal_discord_event_signups s
               on s.event_id = e.id and s.signup_status = 'going' and s.roster_state <> 'completed'
             join portal_characters c
               on c.id = s.character_id and c.active = true
             cross join portal_mounts m
             left join lateral (
               select coalesce(d.level, d.level_required)::int as level
               from portal_discord_duties d
               where d.active = true
                 and coalesce(d.level, d.level_required) is not null
                 and regexp_replace(lower(d.name), '[^a-z0-9]+', '', 'g')
                   = regexp_replace(
                       lower(
                         regexp_replace(
                           coalesce(m.source_name, ''),
                           '^(trial|raid|dungeon|alliance raid|alliance|ultimate|criterion|variant|source)[[:space:]]*:[[:space:]]*',
                           '',
                           'i'
                         )
                       ),
                       '[^a-z0-9]+',
                       '',
                       'g'
                     )
               order by d.sort_order asc, lower(d.name) asc
               limit 1
             ) source_duty on true
             left join portal_character_mounts cm
               on cm.character_id = s.character_id and cm.mount_id = m.id
             where e.id = any($1::bigint[])
               and e.event_type in ('custom', 'raid', 'trial', 'dungeon')
               and m.active = true
               and m.farm_priority = 'farm_target'
               and m.mount_category in ('Trial', 'Raid', 'Dungeon', 'Dungeon / Criterion', 'Variant / Criterion')
               and coalesce(m.source_name, '') ~*
                 '^(trial|raid|dungeon|alliance raid|alliance|ultimate|criterion|variant)[[:space:]]*:'
               and (
                 e.event_type = 'custom'
                 or (e.event_type = 'raid' and m.mount_category = 'Raid')
                 or (e.event_type = 'trial' and m.mount_category = 'Trial')
                 or (e.event_type = 'dungeon' and m.mount_category in ('Dungeon', 'Dungeon / Criterion', 'Variant / Criterion'))
               )
               and source_duty.level is not null
               and (
                 e.level is null
                 or source_duty.level >= e.level
               )
               and (
                 e.level_max is null
                 or source_duty.level <= e.level_max
               )
               and not coalesce(cm.owned, false)
             group by e.id, m.id, m.mount_name, m.source_name, source_duty.level
           ) ranked
           where ranked.suggestion_rank <= 5
           order by ranked.event_id asc, ranked.suggestion_rank asc;`,
          [eventIds]
        )
      : { rows: [] };

    const suggestionsByEvent = new Map<number, PortalMountNeedSuggestion[]>();
    for (const row of suggestionResult.rows) {
      const eventId = Number(row.event_id);
      const suggestion: PortalMountNeedSuggestion = {
        mount_id: Number(row.mount_id),
        mount_name: String(row.mount_name),
        source_name: row.source_name,
        need_count: Number(row.need_count)
      };
      suggestionsByEvent.set(eventId, [...(suggestionsByEvent.get(eventId) || []), suggestion]);
    }

    const signupsByEvent = new Map<number, PortalEventSignup[]>();
    for (const row of signupResult.rows) {
      const eventId = Number(row.event_id);
      const signup: PortalEventSignup = {
        character_id: Number(row.character_id), character_name: String(row.character_name),
        world: String(row.world), signup_status: String(row.signup_status),
        role_preference: String(row.role_preference), secondary_role_preference: String(row.secondary_role_preference || "none"), notes: row.notes,
        roster_state: String(row.roster_state || "active"),
        party_number: row.party_number === null ? null : Number(row.party_number),
        completed_at: row.completed_at, completed_by: row.completed_by,
        attendance_status: String(row.attendance_status || "not_checked_in"),
        checked_in_at: row.checked_in_at, attendance_updated_at: row.attendance_updated_at,
        attendance_updated_by: row.attendance_updated_by,
        created_at: row.created_at, updated_at: row.updated_at,
        needs_target_mount: row.needs_target_mount === null ? null : Boolean(row.needs_target_mount)
      };
      signupsByEvent.set(eventId, [...(signupsByEvent.get(eventId) || []), signup]);
    }
    const events = eventResult.rows.map((row) => {
      const id = Number(row.id);
      const signups = signupsByEvent.get(id) || [];
      return {
        id, event_type: row.event_type, title: row.title, description: row.description,
        level: row.level === null
          ? fallbackLevelsByDutyName.get(
              normalizeDutyLookupName(getDutyNameFromMountSource(row.mount_source_name))
            ) ?? null
          : Number(row.level),
        level_max: row.level_max === null ? null : Number(row.level_max),
        event_time_zone: isSupportedMemberEventTimeZone(String(row.event_time_zone)) ? String(row.event_time_zone) : portalTimeZone,
        duty_id: row.duty_id === null ? null : Number(row.duty_id),
        duty_name: row.duty_name, duty_image_url: row.duty_image_url,
        mount_id: row.mount_id === null ? null : Number(row.mount_id),
        mount_name: row.mount_name, mount_source_name: row.mount_source_name,
        mount_image_url: row.mount_image_url,
        mount_suggestions: suggestionsByEvent.get(id) || [],
        target_channel_kind: row.target_channel_kind, target_channel_id: row.target_channel_id,
        event_starts_at: row.event_starts_at, event_ends_at: row.event_ends_at,
        announcement_post_at: row.announcement_post_at,
        announcement_scheduled_post_id: row.announcement_scheduled_post_id === null ? null : Number(row.announcement_scheduled_post_id),
        party_strategy: row.party_strategy || "rotation", party_size: Number(row.party_size || 8),
        standard_party_roles_required: row.standard_party_roles_required !== false,
        check_in_required: row.check_in_required === true,
        roster_locked: Boolean(row.roster_locked),
        series_id: row.series_id === null ? null : Number(row.series_id), series_name: row.series_name,
        series_occurrence_number: row.series_occurrence_number === null ? null : Number(row.series_occurrence_number),
        reminder_24h_enabled: Boolean(row.reminder_24h_enabled), reminder_1h_enabled: Boolean(row.reminder_1h_enabled),
        last_edited_at: row.last_edited_at, last_edited_by: row.last_edited_by,
        status: row.status, created_by: row.created_by, created_at: row.created_at,
        updated_at: row.updated_at, cancelled_at: row.cancelled_at, cancelled_by: row.cancelled_by,
        expired_at: row.expired_at, archived_at: row.archived_at, archived_by: row.archived_by,
        signups,
        current_signup: character ? signups.find((signup) => memberCharacterIds.has(signup.character_id)) || null : null
      } satisfies PortalMemberEvent;
    });
    return { character, events };
  } finally {
    await client.end();
  }
}
async function getDiscordDuties(limit = 1000): Promise<PortalDiscordDuty[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          id::int,
          duty_type,
          name,
          expansion,
          level,
          party_size,
          image_url,
          notes,
          active,
          sort_order,
                external_source,
                external_id,
                image_override_url,
                manual_override,
                last_synced_at
        from portal_discord_duties
        where active = true
        order by
          sort_order asc,
          coalesce(level, 999) asc,
          lower(name) asc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      duty_type: row.duty_type,
      name: row.name,
      expansion: row.expansion,
      level: row.level === null ? null : Number(row.level),
      party_size: row.party_size === null ? null : Number(row.party_size),
      image_url: row.image_url,
      notes: row.notes,
      active: Boolean(row.active),
      sort_order: Number(row.sort_order ?? 100),
      external_source: row.external_source,
      external_id: row.external_id,
      image_override_url: row.image_override_url,
      manual_override: Boolean(row.manual_override),
      last_synced_at: row.last_synced_at
    }));
  } finally {
    await client.end();
  }
}

async function getDiscordEventMountOptions(
  limit = 250
): Promise<PortalDiscordEventMountOption[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          m.id::int,
          m.mount_name,
          m.source_name,
          m.icon_url,
          m.image_url,
          ms.name as set_name,
          ms.expansion
        from portal_mounts m
        left join portal_mount_sets ms
          on ms.id = m.mount_set_id
        where m.active = true
          and m.farm_priority is distinct from 'ignore'
        order by
          coalesce(ms.sort_order, 999) asc,
          lower(m.mount_name) asc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      mount_name: row.mount_name,
      source_name: row.source_name,
      icon_url: row.icon_url,
      image_url: row.image_url,
      set_name: row.set_name,
      expansion: row.expansion
    }));
  } finally {
    await client.end();
  }
}

async function getEventTemplates(): Promise<PortalEventTemplate[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      select id::int, name, event_type, title, description, level, duty_id::int,
             duty_name, mount_id::int, mount_name, target_channel_kind,
             party_strategy, party_size, standard_party_roles_required, check_in_required, reminder_24h_enabled, reminder_1h_enabled,
             announcement_lead_minutes, created_by, updated_at
      from portal_discord_event_templates
      order by lower(name) asc;
    `);
    return result.rows.map((row) => ({
      id: Number(row.id), name: row.name, event_type: row.event_type, title: row.title,
      description: row.description, level: row.level === null ? null : Number(row.level),
      duty_id: row.duty_id === null ? null : Number(row.duty_id), duty_name: row.duty_name,
      mount_id: row.mount_id === null ? null : Number(row.mount_id), mount_name: row.mount_name,
      target_channel_kind: row.target_channel_kind, party_strategy: row.party_strategy,
      party_size: Number(row.party_size || 8), standard_party_roles_required: row.standard_party_roles_required !== false,
      check_in_required: row.check_in_required === true,
      reminder_24h_enabled: Boolean(row.reminder_24h_enabled),
      reminder_1h_enabled: Boolean(row.reminder_1h_enabled),
      announcement_lead_minutes: Number(row.announcement_lead_minutes ?? 10080),
      created_by: row.created_by, updated_at: row.updated_at
    }));
  } finally {
    await client.end();
  }
}

async function getEventSeries(): Promise<PortalEventSeries[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      select id::int, series_name, recurrence_kind, next_occurrence_at, end_at,
             occurrences_ahead, active, generated_count, last_generated_at,
             created_by, paused_at, ended_at
      from portal_discord_event_series
      order by case when active then 0 else 1 end, next_occurrence_at asc, id desc;
    `);
    return result.rows.map((row) => ({
      id: Number(row.id), series_name: row.series_name, recurrence_kind: row.recurrence_kind,
      next_occurrence_at: row.next_occurrence_at, end_at: row.end_at,
      occurrences_ahead: Number(row.occurrences_ahead || 4), active: Boolean(row.active),
      generated_count: Number(row.generated_count || 0), last_generated_at: row.last_generated_at,
      created_by: row.created_by, paused_at: row.paused_at, ended_at: row.ended_at
    }));
  } finally {
    await client.end();
  }
}
async function getDiscordActionQueue(limit = 50): Promise<PortalDiscordActionQueueItem[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    const result = await client.query(
      `
        select
          q.id::int,
          q.discord_user_id,
          dl.discord_username,
          dl.discord_display_name,
          c.character_name,
          q.action_type,
          q.status,
          q.requested_by,
          q.requested_at,
          q.completed_at,
          q.result_message,
          q.error_message,
          q.action_payload ->> 'note' as action_note
        from portal_discord_action_queue q
        left join portal_discord_links dl
          on dl.discord_user_id = q.discord_user_id
        left join portal_characters c
          on c.id = dl.character_id
        where q.status <> 'archived'
        order by
          case q.status
            when 'pending' then 1
            when 'processing' then 2
            when 'failed' then 3
            when 'completed' then 4
            else 5
          end,
          q.requested_at desc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      discord_user_id: row.discord_user_id,
      discord_username: row.discord_username,
      discord_display_name: row.discord_display_name,
      character_name: row.character_name,
      action_type: row.action_type,
      status: row.status,
      requested_by: row.requested_by,
      requested_at: row.requested_at,
      completed_at: row.completed_at,
      result_message: row.result_message,
      error_message: row.error_message,
      action_note: row.action_note
    }));
  } finally {
    await client.end();
  }
}

async function getDiscordMemberSnapshotReviews(
  limit = 100
): Promise<PortalDiscordMemberSnapshotReview[]> {
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(`
      with reconciled as (
        update portal_discord_member_snapshots snapshot
        set
          present_in_guild = false,
          has_verified_role = false,
          has_unverified_role = false,
          linked_character_id = null,
          linked_character_name = null,
          linked_world = null,
          linked_fc_status = null,
          linked_active = null,
          review_status = 'ok',
          review_reason = null,
          updated_at = now()
        where snapshot.present_in_guild = true
          and exists (
            select 1
            from portal_discord_action_queue action
            where action.discord_user_id = snapshot.discord_user_id
              and action.action_type = 'kick_member'
              and action.status in ('completed', 'archived')
              and (
                action.result_message like 'Kicked %'
                or action.result_message = 'Skipped: Discord member was not found in this server.'
              )
              and coalesce(action.completed_at, action.requested_at) >= coalesce(snapshot.last_scanned_at, '-infinity'::timestamptz)
          )
        returning snapshot.discord_user_id
      )
      delete from portal_discord_roster_review_decisions decision
      using reconciled
      where decision.discord_user_id = reconciled.discord_user_id;
    `);

    const result = await client.query(
      `
        select
          discord_user_id,
          discord_username,
          discord_global_name,
          discord_nickname,
          discord_display_name,
          is_bot,
          has_verified_role,
          has_unverified_role,
          linked_character_id::int,
          linked_character_name,
          linked_world,
          linked_fc_status,
          linked_active,
          review_status,
          review_reason,
          last_scanned_at
        from portal_discord_member_snapshots
        where present_in_guild = true
          and review_status = 'needs_review'
        order by
          has_verified_role desc,
          last_scanned_at desc nulls last,
          lower(coalesce(discord_display_name, discord_nickname, discord_global_name, discord_username, discord_user_id)) asc
        limit $1;
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      discord_user_id: row.discord_user_id,
      discord_username: row.discord_username,
      discord_global_name: row.discord_global_name,
      discord_nickname: row.discord_nickname,
      discord_display_name: row.discord_display_name,
      is_bot: Boolean(row.is_bot),
      has_verified_role: Boolean(row.has_verified_role),
      has_unverified_role: Boolean(row.has_unverified_role),
      linked_character_id:
        row.linked_character_id === null ? null : Number(row.linked_character_id),
      linked_character_name: row.linked_character_name,
      linked_world: row.linked_world,
      linked_fc_status: row.linked_fc_status,
      linked_active:
        row.linked_active === null ? null : Boolean(row.linked_active),
      review_status: row.review_status,
      review_reason: row.review_reason,
      last_scanned_at: row.last_scanned_at
    }));
  } finally {
    await client.end();
  }
}


// =========================
// SECTION 06: Server Actions
// =========================

// -------------------------
// SUBSECTION 06A: Login/logout actions
// -------------------------

async function loadOfficerActivityLog(filters: OfficerActivityFilters, requestedPage = 1) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(userGroups, ["Admins", "Guild Officers"])) {
    throw new Error("You do not have permission to view the officer activity log.");
  }

  const safeFilters: OfficerActivityFilters = {
    search: String(filters?.search || "").trim().slice(0, 160),
    source: String(filters?.source || "all").slice(0, 80),
    outcome: ["all", "success", "failure", "info"].includes(String(filters?.outcome))
      ? String(filters.outcome)
      : "all",
    windowDays: [1, 7, 30, 90].includes(Number(filters?.windowDays))
      ? Number(filters.windowDays)
      : 30
  };

  return getOfficerActivityLog(safeFilters, Math.max(1, Number(requestedPage) || 1));
}

async function loginAction() {
  "use server";
  const provider = String(process.env.AUTH_PROVIDER || "discord").trim().toLowerCase() === "authentik"
    ? "authentik"
    : "discord";
  await signIn(provider, { redirectTo: "/" });
}

async function getFcVerificationStatus(): Promise<PortalFcVerification | null> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalFcVerification>(`
      select fc_lodestone_id,lodestone_url,discord_guild_id,world,datacenter,verification_code,
             status,verified_at,last_checked_at,last_error
      from portal_fc_verification where id=1
    `);
    return result.rows[0] || null;
  } finally { await client.end(); }
}

async function assertFcOwnershipVerified(client: Client) {
  const result = await client.query("select status from portal_fc_verification where id=1");
  if (result.rows[0]?.status !== "verified") {
    throw new Error("Verify ownership of the configured Free Company before changing Discord character links.");
  }
}

async function getMemberCharacterChoices(session:PortalSession){const discordUserId=String(session?.user?.discordUserId||"").trim();if(!discordUserId)return[];const client=await getDbClient();try{await ensurePortalSchema(client);return (await client.query<{id:number;character_name:string;world:string;kind:string}>(`with anchor as(select dl.character_id from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')) select c.id::int,c.character_name,c.world,'FC membership' kind from anchor a join portal_characters c on c.id=a.character_id union all select c.id::int,c.character_name,c.world,'Linked character' kind from portal_alt_character_links l join portal_characters c on c.id=l.character_id cross join anchor where l.discord_user_id=$1 and l.active=true and c.active=true order by kind,character_name`,[discordUserId])).rows;}finally{await client.end();}}

type AltCharacterMemberRow = {
  discord_user_id: string;
  discord_name: string;
  anchor_name: string;
  active_alts: number;
  pending_claims: number;
  custom_limit: number | null;
  effective_limit: number;
  linked_characters: {
    id: number;
    character_name: string;
    world: string;
    verification_method: string;
    verified_by_discord_user_id: string | null;
    verified_at: string;
  }[];
  pending_characters: {
    id: number;
    character_name: string;
    world: string;
    status: string;
    created_at: string;
  }[];
};

function altVerificationLabel(method: string) {
  if (method === "officer_bound") return "Officer override";
  if (method === "officer_approved") return "Officer approved";
  if (method === "self_service_profile_code") return "Profile code verified";
  return method.replaceAll("_", " ");
}

async function getAltCharacterMembers(defaultLimit: number): Promise<AltCharacterMemberRow[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(`
      select dl.discord_user_id,
        coalesce(dl.discord_display_name,dl.discord_global_name,dl.discord_username,dl.discord_user_id) discord_name,
        coalesce(c.character_name,c.display_name,'Unlinked') anchor_name,
        (select count(*)::int from portal_alt_character_links l where l.discord_user_id=dl.discord_user_id and l.active=true) active_alts,
        (select count(*)::int from portal_alt_character_claims q where q.discord_user_id=dl.discord_user_id and q.status in('pending','code_required')) pending_claims,
        coalesce((select json_agg(json_build_object('id',l.id,'character_name',linked.character_name,'world',linked.world,'verification_method',l.verification_method,'verified_by_discord_user_id',l.verified_by_discord_user_id,'verified_at',l.verified_at) order by lower(linked.character_name)) from portal_alt_character_links l join portal_characters linked on linked.id=l.character_id where l.discord_user_id=dl.discord_user_id and l.active=true),'[]'::json) linked_characters,
        coalesce((select json_agg(json_build_object('id',q.id,'character_name',q.character_name,'world',q.world,'status',q.status,'created_at',q.created_at) order by q.created_at desc) from portal_alt_character_claims q where q.discord_user_id=dl.discord_user_id and q.status in('pending','code_required')),'[]'::json) pending_characters,
        lim.max_additional_characters::int custom_limit,
        coalesce(lim.max_additional_characters,$1)::int effective_limit
      from portal_discord_links dl
      left join portal_characters c on c.id=dl.character_id
      left join portal_alt_character_limits lim on lim.discord_user_id=dl.discord_user_id
      order by lower(coalesce(dl.discord_display_name,dl.discord_global_name,dl.discord_username,c.character_name,dl.discord_user_id));
    `,[defaultLimit]);
    return result.rows.map((row)=>({...row,active_alts:Number(row.active_alts||0),pending_claims:Number(row.pending_claims||0),custom_limit:row.custom_limit==null?null:Number(row.custom_limit),effective_limit:Number(row.effective_limit||0),linked_characters:Array.isArray(row.linked_characters)?row.linked_characters.map((linked:Record<string,unknown>)=>({id:Number(linked.id),character_name:String(linked.character_name||""),world:String(linked.world||""),verification_method:String(linked.verification_method||"unknown"),verified_by_discord_user_id:linked.verified_by_discord_user_id?String(linked.verified_by_discord_user_id):null,verified_at:String(linked.verified_at||"")})):[],pending_characters:Array.isArray(row.pending_characters)?row.pending_characters.map((claim:Record<string,unknown>)=>({id:Number(claim.id),character_name:String(claim.character_name||""),world:String(claim.world||""),status:String(claim.status||"pending"),created_at:String(claim.created_at||"")})):[]}));
  } finally { await client.end(); }
}
async function getCollectionSourceWarnings(): Promise<PortalCollectionSourceWarning[]> {
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query<PortalCollectionSourceWarning>(`
      select id, catalog_name, source_type, affected_count, example_items,
        first_observed_at, last_observed_at, resolved_at
      from portal_collection_source_warnings where resolved_at is null
      order by last_observed_at desc, catalog_name, source_type;
    `);
    return result.rows.map((row) => ({ ...row, affected_count: Number(row.affected_count || 0),
      example_items: Array.isArray(row.example_items) ? row.example_items.map(String) : [] }));
  } finally { await client.end(); }
}

async function getPersonalCollectionPage(kind: "achievements" | "titles", characterId: number | null, filters: CollectionFilters): Promise<CollectionCatalogPage> {
  const client = await getDbClient();
  try { await ensurePortalSchema(client); return await getCollectionCatalogPage(client, kind, characterId, filters); }
  finally { await client.end(); }
}

type DiscordApiRole = { id: string; name: string; position: number; permissions: string; managed: boolean };
type DiscordApiChannel = { id: string; name: string; type: number; position: number; parent_id?: string | null; permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }> };
type DiscordApiGuild = { id: string; name: string; owner_id: string };
type DiscordApiUser = { id: string };
type DiscordApiMember = { roles: string[] };

const DISCORD_ADMINISTRATOR = 1n << 3n;
const DISCORD_VIEW_CHANNEL = 1n << 10n;
const DISCORD_SEND_MESSAGES = 1n << 11n;
const DISCORD_MANAGE_ROLES = 1n << 28n;
let discordDiscoveryCache: { key: string; expiresAt: number; value: PortalDiscordResourceDiscovery } | null = null;

function discordPermissions(value: string | undefined) {
  try { return BigInt(value || "0"); } catch { return 0n; }
}

async function discordApi<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

function applyDiscordChannelOverwrites(
  basePermissions: bigint,
  channel: DiscordApiChannel,
  guildId: string,
  botUserId: string,
  memberRoleIds: Set<string>
) {
  if ((basePermissions & DISCORD_ADMINISTRATOR) !== 0n) return ~0n;
  let permissions = basePermissions;
  const overwrites = channel.permission_overwrites || [];
  const everyone = overwrites.find((overwrite) => overwrite.type === 0 && overwrite.id === guildId);
  if (everyone) permissions = (permissions & ~discordPermissions(everyone.deny)) | discordPermissions(everyone.allow);
  let roleDeny = 0n;
  let roleAllow = 0n;
  for (const overwrite of overwrites) {
    if (overwrite.type === 0 && overwrite.id !== guildId && memberRoleIds.has(overwrite.id)) {
      roleDeny |= discordPermissions(overwrite.deny);
      roleAllow |= discordPermissions(overwrite.allow);
    }

  }
  permissions = (permissions & ~roleDeny) | roleAllow;
  const member = overwrites.find((overwrite) => overwrite.type === 1 && overwrite.id === botUserId);
  if (member) permissions = (permissions & ~discordPermissions(member.deny)) | discordPermissions(member.allow);
  return permissions;
}

async function getDiscordResourceDiscovery(
  settings: PortalDiscordBotSettings,
  forceRefresh = false
): Promise<PortalDiscordResourceDiscovery> {
  const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  const guildId = String(settings.guild_id || process.env.DISCORD_GUILD_ID || "").trim();
  const empty = { guildName: "", roles: [], channels: [], warnings: [] };
  if (!token || !guildId) return { ...empty, error: "Complete the Discord bot token and server ID in setup before loading roles and channels." };
  const cacheKey = `${guildId}:${token.slice(-8)}`;
  if (!forceRefresh && discordDiscoveryCache?.key === cacheKey && discordDiscoveryCache.expiresAt > Date.now()) {
    return discordDiscoveryCache.value;
  }
  try {
    const [guild, roles, channels, botUser] = await Promise.all([
      discordApi<DiscordApiGuild>(`/guilds/${guildId}`, token),
      discordApi<DiscordApiRole[]>(`/guilds/${guildId}/roles`, token),
      discordApi<DiscordApiChannel[]>(`/guilds/${guildId}/channels`, token),
      discordApi<DiscordApiUser>("/users/@me", token)
    ]);
    const member = await discordApi<DiscordApiMember>(`/guilds/${guildId}/members/${botUser.id}`, token);
    const memberRoleIds = new Set([guildId, ...(member.roles || [])]);
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    let basePermissions = 0n;
    for (const roleId of memberRoleIds) basePermissions |= discordPermissions(roleMap.get(roleId)?.permissions);
    const botIsOwner = guild.owner_id === botUser.id;
    const canManageRoles = botIsOwner || (basePermissions & (DISCORD_ADMINISTRATOR | DISCORD_MANAGE_ROLES)) !== 0n;
    const botHighestRolePosition = Math.max(0, ...member.roles.map((roleId) => roleMap.get(roleId)?.position || 0));
    const assignableRoles = canManageRoles
      ? roles
          .filter((role) => role.id !== guildId && !role.managed && role.position < botHighestRolePosition)
          .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
          .map((role) => ({ id: role.id, label: `@${role.name}` }))
      : [];
    const categories = new Map(channels.filter((channel) => channel.type === 4).map((channel) => [channel.id, channel]));
    const usableChannels = channels
      .filter((channel) => channel.type === 0 || channel.type === 5)
      .map((channel) => ({
        channel,
        permissions: botIsOwner ? ~0n : applyDiscordChannelOverwrites(basePermissions, channel, guildId, botUser.id, memberRoleIds)
      }))
      .filter(({ permissions }) => (permissions & DISCORD_VIEW_CHANNEL) !== 0n && (permissions & DISCORD_SEND_MESSAGES) !== 0n)
      .sort((a, b) => {
        const categoryA = categories.get(a.channel.parent_id || "")?.position ?? -1;
        const categoryB = categories.get(b.channel.parent_id || "")?.position ?? -1;
        return categoryA - categoryB || a.channel.position - b.channel.position || a.channel.name.localeCompare(b.channel.name);
      })
      .map(({ channel }) => {
        const category = categories.get(channel.parent_id || "");
        return { id: channel.id, label: `${category ? `${category.name} / ` : ""}#${channel.name}` };
      });
    const warnings: string[] = [];
    if (!canManageRoles) warnings.push("The bot lacks Manage Roles, so assignable role choices cannot be shown.");
    if (!usableChannels.length) warnings.push("No text channels with View Channel and Send Messages permissions were found.");
    const value = { guildName: guild.name, roles: assignableRoles, channels: usableChannels, warnings, error: null };
    discordDiscoveryCache = { key: cacheKey, expiresAt: Date.now() + 60_000, value };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discord could not be reached.";
    return { ...empty, error: `Could not load Discord roles and channels. ${message}` };
  }
}

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

async function setMemberEmulationAction(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!getUserGroupsFromSession(session).includes("Admins")) throw new Error("Administrator access is required to emulate a member.");
  const enabled = String(formData.get("enabled") || "") === "true";
  const requestedReturnTo = String(formData.get("returnTo") || "/?view=home").trim();
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") && !requestedReturnTo.includes("\\") ? requestedReturnTo : "/?view=home";
  const requestHeaders = await headers();
  const forwardedProto = String(requestHeaders.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  const origin = String(requestHeaders.get("origin") || "").trim().toLowerCase();
  (await cookies()).set(portalMemberEmulationCookie, enabled ? "1" : "", { httpOnly:true, sameSite:"lax", secure:forwardedProto==="https"||(!forwardedProto&&origin.startsWith("https://")), maxAge:enabled?28800:0, path:"/" });
  revalidatePath("/");
  redirect(enabled ? "/?view=home" : returnTo);
}

async function switchCharacterAction(formData:FormData){"use server";const session=(await auth()) as PortalSession;const discordUserId=String(session?.user?.discordUserId||"").trim(),characterId=Number(formData.get("characterId")||0);if(!discordUserId||!Number.isInteger(characterId))throw new Error("Choose a valid linked character.");const client=await getDbClient();try{await ensurePortalSchema(client);const allowed=await client.query(`with anchor as(select dl.character_id from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')) select 1 from anchor where character_id=$2 union all select 1 from portal_alt_character_links l cross join anchor where l.discord_user_id=$1 and l.character_id=$2 and l.active=true limit 1`,[discordUserId,characterId]);if(!allowed.rows.length)throw new Error("That character is not linked to your current FC membership.");const requestHeaders=await headers(),forwardedProto=String(requestHeaders.get("x-forwarded-proto")||"").split(",")[0].trim().toLowerCase(),origin=String(requestHeaders.get("origin")||"").trim().toLowerCase();(await cookies()).set("portal_active_character",String(characterId),{httpOnly:true,sameSite:"lax",secure:forwardedProto==="https"||(!forwardedProto&&origin.startsWith("https://")),maxAge:31536000,path:"/"});}finally{await client.end();}revalidatePath("/");}

async function createPortableBackup() {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!getUserGroupsFromSession(session).includes("Admins")) {
    throw new Error("Administrator access is required to create a portable backup.");
  }
  const requestedBy = String(session?.user?.discordUserId || session?.user?.email || session?.user?.name || "Portal administrator");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await queuePortalBackup(client, requestedBy);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function clearBackupHistory() {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!getUserGroupsFromSession(session).includes("Admins")) {
    throw new Error("Administrator access is required to clear backup history.");
  }
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await clearPortalBackupHistory(client);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function getOfficerBackgroundActionStatus(kind: string) {
  "use server";
  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  if (kind === "backup" && !groups.includes("Admins")) throw new Error("Administrator access is required.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    if (kind === "backup") {
      const row = (await client.query(`select id::text,status,coalesce(completed_at,started_at,requested_at)::text changed_at,coalesce(error_text,'') message from portal_backup_jobs order by requested_at desc,id desc limit 1`)).rows[0];
      if (!row) return { signature: "", complete: false };
      return { signature: `${row.id}:${row.status}:${row.changed_at}`, complete: ["completed","failed"].includes(row.status), failed: row.status === "failed", message: row.status === "completed" ? "Backup completed and is ready in the backups folder." : row.message || undefined };
    }
    const requestType = kind === "fc-verification" ? "fc_verification_check" : kind === "fc-roster" ? "fc_roster_scan" : "";
    if (!requestType) throw new Error("Unknown background request.");
    const row = (await client.query(`select id::text,status,coalesce(completed_at,started_at,requested_at)::text changed_at,coalesce(message,'') message from portal_worker_requests where request_type=$1 order by requested_at desc,id desc limit 1`,[requestType])).rows[0];
    if (!row) return { signature: "", complete: false };
    const complete = !["pending","running","processing"].includes(row.status);
    return { signature: `${row.id}:${row.status}:${row.changed_at}`, complete, failed: row.status === "failed", message: complete ? row.message || (row.status === "failed" ? "The worker could not complete the request." : "Background update completed.") : undefined };
  } finally { await client.end(); }
}

// -------------------------
// SUBSECTION 06B: Portal settings actions
// -------------------------

async function savePortalBranding(_previous: { ok: boolean; message: string }, formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    return { ok: false, message: "Officer access is required to change branding." };
  }
  try {
    const logo = await prepareBrandingImage(formData.get("logo"));
    const banner = await prepareBrandingImage(formData.get("banner"));
    const resetLogo = formData.get("resetLogo") === "on";
    const resetBanner = formData.get("resetBanner") === "on";
    if ((logo && resetLogo) || (banner && resetBanner)) return { ok: false, message: "Choose either an upload or reset for each image, not both." };
    if (!logo && !banner && !resetLogo && !resetBanner) return { ok: false, message: "Choose an image or a reset option first." };
    const changes: Record<string, string> = {};
    if (logo) changes.portalLogoUrl = await storeBrandingImage(logo);
    if (banner) changes.portalBannerUrl = await storeBrandingImage(banner);
    if (resetLogo) changes.portalLogoUrl = "";
    if (resetBanner) changes.portalBannerUrl = "";
    const client = await getDbClient();
    try {
      await ensurePortalSchema(client);
      await client.query("BEGIN");
      for (const [key, value] of Object.entries(changes)) {
        await client.query("insert into portal_settings (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [key, value]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { await client.end(); }
    revalidatePath("/");
    return { ok: true, message: "Logo and banner saved. The site now uses your updated branding." };
  } catch (error) {
    return { ok: false, message: error instanceof Error && /^(Choose a PNG|Each branding)/.test(error.message) ? error.message : "Branding could not be saved. Check storage and database availability, then try again." };
  }
}

async function savePortalSettings(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to update portal settings.");
  }

  const backgroundColor = String(formData.get("backgroundColor") ?? "").trim();
  const accentColor = String(formData.get("accentColor") ?? "").trim();
  const tileColor = String(formData.get("tileColor") ?? "").trim();
  if (![backgroundColor, accentColor, tileColor].every((value) => /^#[0-9a-f]{6}$/i.test(value))) {
    throw new Error("Choose valid six-digit portal colors.");
  }

  const nextSettings: Record<string, string> = {
    backgroundColor,
    accentColor,
    tileColor,
    discordInviteUrl: String(formData.get("discordInviteUrl") ?? "").trim(),
    discordInvitePublic: formData.get("discordInvitePublic") === "on" ? "true" : "false",
    raidProgressionText: String(formData.get("raidProgressionText") ?? "").trim(),
    raidScheduleText: String(formData.get("raidScheduleText") ?? "").trim(),
    raidExpectationsText: String(formData.get("raidExpectationsText") ?? "").trim(),
    raidRecruitmentText: String(formData.get("raidRecruitmentText") ?? "").trim(),
    lodestoneUrl: String(formData.get("lodestoneUrl") ?? "").trim(),
    recruitmentLodestoneUrl: String(formData.get("recruitmentLodestoneUrl") ?? "").trim(),
    directDiscordContactUrl: String(formData.get("directDiscordContactUrl") ?? "").trim(),
    welcomeText: String(formData.get("welcomeText") ?? "").trim(),
    announcementText: String(formData.get("announcementText") ?? "").trim()
  };

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    for (const [key, value] of Object.entries(nextSettings)) {
      await client.query(
        `
          insert into portal_settings (key, value, updated_at)
          values ($1, $2, now())
          on conflict (key)
          do update set value = excluded.value, updated_at = now();
        `,
        [key, value]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function savePortalThemeColor(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required to edit the portal theme.");
  }
  const allowedKeys = new Set(["backgroundColor", "backgroundSecondaryColor", "sidebarColor", "tileColor", "insetColor", "borderColor", "accentColor", "labelColor", "headingColor", "textColor", "mutedTextColor"]);
  let requested: Record<string, unknown>;
  try {
    requested = JSON.parse(String(formData.get("colors") || "{}")) as Record<string, unknown>;
  } catch {
    throw new Error("Choose valid portal colors.");
  }
  const changes = Object.entries(requested);
  if (!changes.length || changes.some(([key, color]) => !allowedKeys.has(key) || typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error("Choose valid portal colors.");
  }
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("BEGIN");
    for (const [key, color] of changes) {
      await client.query(
        "insert into portal_settings (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
        [key, color]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function savePortalNavigationOrder(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required to edit portal navigation.");
  }
  let requested: unknown;
  try {
    requested = JSON.parse(String(formData.get("navigationOrder") || "[]"));
  } catch {
    throw new Error("Choose a valid menu order.");
  }
  const allowed = new Set(defaultNavigationOrder);
  if (!Array.isArray(requested) || requested.length !== allowed.size || requested.some((value) => typeof value !== "string" || !allowed.has(value as PortalView)) || new Set(requested).size !== allowed.size) {
    throw new Error("Choose a valid menu order.");
  }
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      "insert into portal_settings (key, value, updated_at) values ('navigationOrder', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
      [JSON.stringify(requested)]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function saveAdditionalPortalAdministrators(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins"])) {
    throw new Error("Administrator access is required to manage portal administrators.");
  }
  const requested = formData.getAll("additionalAdminDiscordIds").flatMap((value) => String(value || "").split(/[\s,]+/)).filter(Boolean);
  if (requested.length > 50) throw new Error("No more than 50 additional administrators may be configured.");
  const invalid = requested.find((value) => !/^\d{15,22}$/.test(value));
  if (invalid) throw new Error(`${invalid} is not a valid numeric Discord user ID.`);
  const primaryIds = new Set(installationPrimaryAdminDiscordId ? [installationPrimaryAdminDiscordId] : []);
  const additionalIds = [...new Set(requested)].filter((value) => !primaryIds.has(value));
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `insert into portal_settings (key, value, updated_at) values ('additionalAdminDiscordIds', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now();`,
      [additionalIds.join(",")]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function saveDiscordCommandAdministration(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required to manage Discord commands.");
  }
  const enabled = new Set(formData.getAll("enabledDiscordCommands").map((value) => String(value).trim()));
  const disabled = discordCommandOptions
    .filter((command) => !("required" in command && command.required) && !enabled.has(command.name))
    .map((command) => command.name);
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `insert into portal_settings (key, value, updated_at) values ('discordDisabledCommands', $1, now()) on conflict (key) do update set value=excluded.value, updated_at=now();`,
      [disabled.join(",")]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06B1: Member privacy settings action
// -------------------------

async function saveMemberPreferences(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const character = await requireEligibleMemberCharacter(session);
  const discordUserId = String(session?.user?.discordUserId ?? "").trim();
  if (!discordUserId) throw new Error("A verified Discord identity is required to save member settings.");

  const value = (name: string, fallback = "") => String(formData.get(name) ?? fallback).trim();
  const mountWinNotificationsEnabled = formData.get("mountWinNotificationsEnabled") === "on";
  const eventReminderLevel = value("eventReminderLevel", "all");
  const defaultEventRole = value("defaultEventRole", "flexible");
  const secondaryEventRole = value("secondaryEventRole", "none");
  const eventTimeZone = value("eventTimeZone", portalTimeZone);
  const motionPreference = value("motionPreference", "automatic");
  const layoutDensity = value("layoutDensity", "comfortable");
  const textScale = value("textScale", "standard");
  const timeZoneMode = value("timeZoneMode", "central");
  const timeFormat = value("timeFormat", "12");
  const animeLanguage = value("animeLanguage", "all");
  const animePlatforms = formData.getAll("animePlatforms").map((item) => String(item).trim()).filter(Boolean);
  const animeDefaultView = value("animeDefaultView", "upcoming");
  const defaultMountTab = value("defaultMountTab", "collection");
  const defaultMinionTab = value("defaultMinionTab", "collection");
  const defaultMinionCategory = value("defaultMinionCategory");
  const defaultLandingView = value("defaultLandingView", "home");

  const allowedRoles = new Set(["tank", "healer", "melee_dps", "ranged_dps", "caster", "flexible"]);
  const allowedMinionCategories = new Set(["", "farmable", "gathering", "gardening", "crafting", "tribal", "island_sanctuary", "pvp", "event", "quest", "vendor", "premium", "achievement", "gold_saucer", "other"]);
  const allowedLandingViews = new Set(["home", "announcements", "polls", "events", "crafting", "guides", "members", "mounts", "minions", "titles", "achievements", "anime", "giveaways", "fc-info", "links", "gallery"]);
  if (!allowedRoles.has(defaultEventRole) || !(secondaryEventRole === "none" || allowedRoles.has(secondaryEventRole))) throw new Error("Choose valid event roles.");
  if (!isSupportedMemberEventTimeZone(eventTimeZone)) throw new Error("Choose a valid event timezone.");
  if (!["all", "final", "none"].includes(eventReminderLevel)) throw new Error("Choose a valid event reminder preference.");
  if (!["automatic", "on", "off"].includes(motionPreference)) throw new Error("Choose a valid motion preference.");
  if (!["comfortable", "compact"].includes(layoutDensity)) throw new Error("Choose a valid layout density.");
  if (!["standard", "medium", "large"].includes(textScale)) throw new Error("Choose a valid text size.");
  if (!["central", "local"].includes(timeZoneMode) || !["12", "24"].includes(timeFormat)) throw new Error("Choose valid time display options.");
  if (!["all", "sub", "dub"].includes(animeLanguage) || !["upcoming", "calendar"].includes(animeDefaultView)) throw new Error("Choose valid anime defaults.");
  if (!["collection", "marketboard"].includes(defaultMountTab) || !["collection", "marketboard"].includes(defaultMinionTab)) throw new Error("Choose valid tracker defaults.");
  if (!allowedMinionCategories.has(defaultMinionCategory) || !allowedLandingViews.has(defaultLandingView)) throw new Error("Choose valid navigation defaults.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    try {
      const updated = await client.query(
        `update portal_characters set mount_win_notifications_enabled = $1, updated_at = now()
         where id in(select dl.character_id from portal_discord_links dl where dl.discord_user_id=$2 union select acl.character_id from portal_alt_character_links acl where acl.discord_user_id=$2 and acl.active=true);`,
        [mountWinNotificationsEnabled, discordUserId]
      );
      if ((updated.rowCount ?? 0) < 1) throw new Error("Your linked character is no longer eligible to update member settings.");

      await client.query(
        `insert into portal_member_preferences (
           discord_user_id, artwork_public_enabled, gaming_setup_public_enabled, pet_public_enabled, glamour_public_enabled,
           event_reminder_mentions_enabled, event_reminder_level, default_event_role, secondary_event_role,
           motion_effects_enabled, motion_preference, layout_density, text_scale, high_contrast_enabled, data_saver_enabled,
           card_flip_enabled, time_zone_mode, time_format, anime_language, anime_platforms, anime_default_view,
           hide_owned_mounts, hide_owned_minions, hide_owned_titles, hide_owned_achievements, default_mount_tab, default_minion_tab, default_minion_category,
           default_landing_view, created_at, updated_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,now(),now()
         )
         on conflict (discord_user_id) do update set
           artwork_public_enabled=excluded.artwork_public_enabled,
           gaming_setup_public_enabled=excluded.gaming_setup_public_enabled,
           pet_public_enabled=excluded.pet_public_enabled,
           glamour_public_enabled=excluded.glamour_public_enabled,
           event_reminder_mentions_enabled=excluded.event_reminder_mentions_enabled,
           event_reminder_level=excluded.event_reminder_level,
           default_event_role=excluded.default_event_role,
           secondary_event_role=excluded.secondary_event_role,
           motion_effects_enabled=excluded.motion_effects_enabled,
           motion_preference=excluded.motion_preference,
           layout_density=excluded.layout_density,
           text_scale=excluded.text_scale,
           high_contrast_enabled=excluded.high_contrast_enabled,
           data_saver_enabled=excluded.data_saver_enabled,
           card_flip_enabled=excluded.card_flip_enabled,
           time_zone_mode=excluded.time_zone_mode,
           time_format=excluded.time_format,
           anime_language=excluded.anime_language,
           anime_platforms=excluded.anime_platforms,
           anime_default_view=excluded.anime_default_view,
           hide_owned_mounts=excluded.hide_owned_mounts,
           hide_owned_minions=excluded.hide_owned_minions,
           hide_owned_titles=excluded.hide_owned_titles,
           hide_owned_achievements=excluded.hide_owned_achievements,
           default_mount_tab=excluded.default_mount_tab,
           default_minion_tab=excluded.default_minion_tab,
           default_minion_category=excluded.default_minion_category,
           default_landing_view=excluded.default_landing_view,
           updated_at=now();`,
        [
          discordUserId,
          formData.get("artworkPublicEnabled") === "on",
          formData.get("gamingSetupPublicEnabled") === "on",
          formData.get("petPublicEnabled") === "on",
          formData.get("glamourPublicEnabled") === "on",
          eventReminderLevel !== "none",
          eventReminderLevel,
          defaultEventRole,
          secondaryEventRole,
          motionPreference !== "off",
          motionPreference,
          layoutDensity,
          textScale,
          formData.get("highContrastEnabled") === "on",
          formData.get("dataSaverEnabled") === "on",
          formData.get("cardFlipEnabled") === "on",
          timeZoneMode,
          timeFormat,
          animeLanguage,
          animePlatforms.join(","),
          animeDefaultView,
          formData.get("hideOwnedMounts") === "on",
          formData.get("hideOwnedMinions") === "on",
          formData.get("hideOwnedTitles") === "on",
          formData.get("hideOwnedAchievements") === "on",
          defaultMountTab,
          defaultMinionTab,
          defaultMinionCategory,
          defaultLandingView
        ]
      );
      await client.query(
        `update portal_member_preferences set event_time_zone = $2, updated_at = now() where discord_user_id = $1;`,
        [discordUserId, eventTimeZone]
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
// -------------------------
// SUBSECTION 06C: Role manager actions
// -------------------------

async function saveGuideResource(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const resourceId = Number(formData.get("guideResourceId") || 0);
  if (!Number.isFinite(resourceId) || resourceId <= 0) throw new Error("Invalid guide.");
  const category = String(formData.get("guideCategory") ?? "").trim().slice(0, 80) || "Resource";
  const title = String(formData.get("guideTitle") ?? "").trim().slice(0, 160);
  const body = String(formData.get("guideBody") ?? "").trim().slice(0, 1600);
  const url = String(formData.get("guideUrl") ?? "").trim().slice(0, 500) || null;
  const sortOrder = Math.max(0, Math.min(9999, Number(formData.get("guideSortOrder") || 100) || 100));
  const visibilityMode = String(formData.get("guideVisibility") ?? "members") === "public" ? "public" : "members";
  if (!title || !body) throw new Error("A guide needs a title and description.");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Guide links must begin with http:// or https://.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `update portal_guide_resources
       set category=$1, title=$2, body=$3, url=$4, sort_order=$5, visibility_mode=$6, updated_at=now()
       where id=$7 and archived_at is null;`,
      [category, title, body, url, sortOrder, visibilityMode, resourceId]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function createGuideResource(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const category = String(formData.get("guideCategory") ?? "").trim().slice(0, 80) || "Resource";
  const title = String(formData.get("guideTitle") ?? "").trim().slice(0, 160);
  const body = String(formData.get("guideBody") ?? "").trim().slice(0, 1600);
  const url = String(formData.get("guideUrl") ?? "").trim().slice(0, 500) || null;
  const sortOrder = Math.max(0, Math.min(9999, Number(formData.get("guideSortOrder") || 100) || 100));
  const visibilityMode = String(formData.get("guideVisibility") ?? "members") === "public" ? "public" : "members";
  if (!title || !body) throw new Error("A new guide needs a title and description.");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Guide links must begin with http:// or https://.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `insert into portal_guide_resources (category, title, body, url, sort_order, visibility_mode)
       values ($1, $2, $3, $4, $5, $6);`,
      [category, title, body, url, sortOrder, visibilityMode]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function archiveGuideResource(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const resourceId = Number(formData.get("guideResourceId") || 0);
  if (!Number.isFinite(resourceId) || resourceId <= 0) throw new Error("Invalid guide.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`update portal_guide_resources set archived_at = now(), updated_at = now() where id = $1;`, [resourceId]);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
async function saveFcInformationSettings(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const clean = (key: string, limit: number) => String(formData.get(key) ?? "").trim().slice(0, limit);
  const values: Array<[keyof PortalSettings, string]> = [
    ["fcAboutText", clean("fcAboutText", 1200)],
    ["fcHouseName", clean("fcHouseName", 160)],
    ["fcHouseLocation", clean("fcHouseLocation", 240)],
    ["fcHouseDescription", clean("fcHouseDescription", 1200)]
  ];
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    for (const [key, value] of values) {
      await client.query(
        `insert into portal_settings (key, value, updated_at)
         values ($1, $2, now())
         on conflict (key) do update set value = excluded.value, updated_at = now();`,
        [key, value]
      );
    }
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function saveFcInfoCard(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const cardId = Number(formData.get("fcInfoCardId") || 0);
  if (!Number.isFinite(cardId) || cardId <= 0) throw new Error("Invalid information card.");
  const label = String(formData.get("fcInfoCardLabel") ?? "").trim().slice(0, 80) || "Free Company";
  const title = String(formData.get("fcInfoCardTitle") ?? "").trim().slice(0, 160);
  const body = String(formData.get("fcInfoCardBody") ?? "").trim().slice(0, 1600);
  const sortOrder = Math.max(0, Math.min(9999, Number(formData.get("fcInfoCardSortOrder") || 100) || 100));
  if (!title || !body) throw new Error("An information card needs a title and description.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `update portal_fc_info_cards
       set label = $1, title = $2, body = $3, sort_order = $4, updated_at = now()
       where id = $5 and archived_at is null;`,
      [label, title, body, sortOrder, cardId]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function createFcInfoCard(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const label = String(formData.get("fcInfoCardLabel") ?? "").trim().slice(0, 80) || "Free Company";
  const title = String(formData.get("fcInfoCardTitle") ?? "").trim().slice(0, 160);
  const body = String(formData.get("fcInfoCardBody") ?? "").trim().slice(0, 1600);
  const sortOrder = Math.max(0, Math.min(9999, Number(formData.get("fcInfoCardSortOrder") || 100) || 100));
  if (!title || !body) throw new Error("A new information card needs a title and description.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `insert into portal_fc_info_cards (label, title, body, sort_order)
       values ($1, $2, $3, $4);`,
      [label, title, body, sortOrder]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function archiveFcInfoCard(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const cardId = Number(formData.get("fcInfoCardId") || 0);
  if (!Number.isFinite(cardId) || cardId <= 0) throw new Error("Invalid information card.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`update portal_fc_info_cards set archived_at = now(), updated_at = now() where id = $1;`, [cardId]);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
async function uploadFcGalleryImages(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  if (String(formData.get("contentRights") || "") !== "on") {
    throw new Error("Confirm that you have permission to upload and display these photos.");
  }

  const files = formData
    .getAll("galleryImages")
    .filter((entry): entry is File => typeof entry !== "string" && entry.size > 0);
  if (!files.length) {
    throw new Error("Choose at least one image to upload.");
  }
  if (files.length > 4) {
    throw new Error("Upload up to 4 gallery images at a time.");
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  for (const file of files) {
    if (!allowedTypes.has(file.type)) {
      throw new Error("Gallery images must be JPG, PNG, or WebP files.");
    }
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("Each gallery image must be 25 MB or smaller.");
    }
  }

  const title = String(formData.get("galleryTitle") ?? "FC Gallery Photo").trim().slice(0, 160) || "FC Gallery Photo";
  const altText = String(formData.get("galleryAltText") ?? "").trim().slice(0, 240);
  const createdBy = session?.user?.name || session?.user?.email || "Officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    for (const file of files) {
      const imageData = Buffer.from(await file.arrayBuffer());
      await client.query(
        `insert into portal_fc_gallery_images (title, alt_text, mime_type, image_data, image_size, created_by)
         values ($1, $2, $3, $4, $5, $6);`,
        [title, altText || title, file.type, imageData, file.size, createdBy]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function archiveFcGalleryImage(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const imageId = Number(formData.get("galleryImageId") || 0);
  if (!Number.isFinite(imageId) || imageId <= 0) {
    throw new Error("Invalid gallery image.");
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`update portal_fc_gallery_images set archived_at = now() where id = $1;`, [imageId]);
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
async function saveFcGalleryImageDetails(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const imageId = Number(formData.get("galleryImageId") || 0);
  if (!Number.isFinite(imageId) || imageId <= 0) {
    throw new Error("Invalid gallery image.");
  }

  const title = String(formData.get("galleryTitle") ?? "").trim().slice(0, 160) || "FC Gallery Photo";
  const altText = String(formData.get("galleryAltText") ?? "").trim().slice(0, 240) || title;
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `update portal_fc_gallery_images
       set title = $1, alt_text = $2
       where id = $3 and archived_at is null;`,
      [title, altText, imageId]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
async function savePortalLinkCard(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const linkId = Number(formData.get("linkCardId") || 0);
  const label = String(formData.get("linkLabel") ?? "").trim().slice(0, 80);
  const url = String(formData.get("linkUrl") ?? "").trim().slice(0, 500);
  const description = String(formData.get("linkDescription") ?? "").trim().slice(0, 280) || null;
  const sortOrder = Math.max(0, Math.min(9999, Number.parseInt(String(formData.get("linkSortOrder") ?? "100"), 10) || 100));
  const removeCustomImage = formData.get("removeCustomImage") === "on";
  const image = formData.get("linkImage");

  if (!label) throw new Error("A link title is required.");
  if (!/^https?:\/\//i.test(url)) throw new Error("Link URLs must begin with http:// or https://.");
  if (image instanceof File && image.size > 0) {
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(image.type)) {
      throw new Error("Link artwork must be a JPG, PNG, or WebP image.");
    }
    if (image.size > 4 * 1024 * 1024) throw new Error("Link artwork must be 4 MB or smaller.");
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const createdBy = session?.user?.name || session?.user?.email || "Officer";
    const imageData = image instanceof File && image.size > 0 ? Buffer.from(await image.arrayBuffer()) : null;

    if (Number.isFinite(linkId) && linkId > 0) {
      const current = await client.query<{ id: number }>(`select id::int from portal_link_cards where id = $1 and archived_at is null limit 1;`, [linkId]);
      if (!current.rows[0]) throw new Error("That link no longer exists.");
      if (imageData && image instanceof File) {
        await client.query(
          `update portal_link_cards
           set label=$1, url=$2, description=$3, sort_order=$4,
               image_mime_type=$5, image_data=$6, image_size=$7, updated_at=now()
           where id=$8;`,
          [label, url, description, sortOrder, image.type, imageData, image.size, linkId]
        );
      } else if (removeCustomImage) {
        await client.query(
          `update portal_link_cards
           set label=$1, url=$2, description=$3, sort_order=$4,
               image_mime_type=null, image_data=null, image_size=null, updated_at=now()
           where id=$5;`,
          [label, url, description, sortOrder, linkId]
        );
      } else {
        await client.query(
          `update portal_link_cards
           set label=$1, url=$2, description=$3, sort_order=$4, updated_at=now()
           where id=$5;`,
          [label, url, description, sortOrder, linkId]
        );
      }
    } else {
      await client.query(
        `insert into portal_link_cards
          (label, url, description, sort_order, image_mime_type, image_data, image_size, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [label, url, description, sortOrder, image instanceof File && imageData ? image.type : null, imageData, image instanceof File && imageData ? image.size : null, createdBy]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function archivePortalLinkCard(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  const linkId = Number(formData.get("linkCardId") || 0);
  if (!Number.isFinite(linkId) || linkId <= 0) throw new Error("Invalid link.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`update portal_link_cards set archived_at = now(), updated_at = now() where id = $1;`, [linkId]);
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function savePublicContentSettings(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const clean = (key: string, limit: number) => String(formData.get(key) ?? "").trim().slice(0, limit);
  const nextSettings: Array<[keyof PortalSettings, string]> = [
    ["fcAboutText", clean("fcAboutText", 1200)],
    ["fcActivitiesText", clean("fcActivitiesText", 1200)],
    ["fcScheduleText", clean("fcScheduleText", 1200)],
    ["fcRecruitmentText", clean("fcRecruitmentText", 1200)],
    ["fcHouseName", clean("fcHouseName", 160)],
    ["fcHouseLocation", clean("fcHouseLocation", 240)],
    ["fcHouseDescription", clean("fcHouseDescription", 1200)],
    ["communityLinkOneLabel", clean("communityLinkOneLabel", 80)],
    ["communityLinkOneUrl", clean("communityLinkOneUrl", 500)],
    ["communityLinkTwoLabel", clean("communityLinkTwoLabel", 80)],
    ["communityLinkTwoUrl", clean("communityLinkTwoUrl", 500)]
  ];

  for (const [key, value] of nextSettings) {
    if (key.endsWith("Url") && value && !/^https?:\/\//i.test(value)) {
      throw new Error("Public links must begin with http:// or https://.");
    }
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    for (const [key, value] of nextSettings) {
      await client.query(
        `insert into portal_settings (key, value, updated_at)
         values ($1, $2, now())
         on conflict (key) do update set value = excluded.value, updated_at = now();`,
        [key, value]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
async function createPortalAnnouncement(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const title = String(formData.get("announcementTitle") ?? "").trim().slice(0, 160);
  const body = String(formData.get("announcementBody") ?? "").trim().slice(0, 4000);
  const category = String(formData.get("announcementCategory") ?? "Community").trim().slice(0, 48) || "Community";
  if (!title || !body) {
    throw new Error("An announcement needs both a title and message.");
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `insert into portal_announcements (title, body, category, created_by, published_at, updated_at)
       values ($1, $2, $3, $4, now(), now());`,
      [title, body, category, session?.user?.email || session?.user?.name || "Officer"]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function archivePortalAnnouncement(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const announcementId = Number(formData.get("announcementId") || 0);
  if (!Number.isFinite(announcementId) || announcementId <= 0) {
    throw new Error("Invalid announcement.");
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `update portal_announcements set archived_at = now(), updated_at = now() where id = $1;`,
      [announcementId]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
async function saveRole(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to update roles.");
  }

  const roleName = String(formData.get("roleName") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "100").trim();
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (!roleName) {
    throw new Error("Role name is required.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        insert into portal_roles (name, sort_order, updated_at)
        values ($1, $2, now())
        on conflict (name)
        do update set sort_order = excluded.sort_order, updated_at = now();
      `,
      [roleName, Number.isFinite(sortOrder) ? sortOrder : 100]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function deleteRole(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to delete roles.");
  }

  const roleName = String(formData.get("roleName") ?? "").trim();

  if (!roleName || roleName === "Member") {
    return;
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        delete from portal_roles
        where name = $1;
      `,
      [roleName]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06D: Character manager actions
// -------------------------

async function saveCharacter(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to update characters.");
  }

  const characterName = String(formData.get("characterName") ?? "").trim();
  const lodestoneCharacterId = String(formData.get("lodestoneCharacterId") ?? "").trim();
  const ffxivCollectCharacterId = String(formData.get("ffxivCollectCharacterId") ?? "").trim();
  const authentikEmail = String(formData.get("authentikEmail") ?? "").trim();
  const role = String(formData.get("role") ?? "Member").trim() || "Member";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!characterName) {
    throw new Error("Character name is required.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        insert into portal_characters (
          display_name,
          character_name,
          world,
          lodestone_character_id,
          ffxiv_collect_character_id,
          authentik_email,
          role,
          notes,
          active,
          sync_status,
          updated_at
        )
        values ($1, $1, $2, nullif($3, ''), nullif($4, ''), nullif($5, ''), $6, nullif($7, ''), true, 'pending', now());
      `,
      [
        characterName,
        defaultWorld,
        lodestoneCharacterId,
        ffxivCollectCharacterId,
        authentikEmail,
        role,
        notes
      ]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function updateCharacter(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to update characters.");
  }

  const characterId = Number.parseInt(String(formData.get("characterId") ?? ""), 10);
  const characterName = String(formData.get("characterName") ?? "").trim();
  const lodestoneCharacterId = String(formData.get("lodestoneCharacterId") ?? "").trim();
  const ffxivCollectCharacterId = String(formData.get("ffxivCollectCharacterId") ?? "").trim();
  const authentikEmail = String(formData.get("authentikEmail") ?? "").trim();
  const role = String(formData.get("role") ?? "Member").trim() || "Member";
  const notes = String(formData.get("notes") ?? "").trim();
  const active = formData.get("active") === "on";
  const mountWinNotificationsEnabled = formData.get("mountWinNotificationsEnabled") === "on";

  if (!Number.isFinite(characterId) || characterId <= 0) {
    throw new Error("Invalid character ID.");
  }

  if (!characterName) {
    throw new Error("Character name is required.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        update portal_characters
        set
          display_name = $2,
          character_name = $2,
          world = $3,
          lodestone_character_id = nullif($4, ''),
          ffxiv_collect_character_id = nullif($5, ''),
          authentik_email = nullif($6, ''),
          role = $7,
          notes = nullif($8, ''),
          active = $9,
          mount_win_notifications_enabled = $10,
          sync_status = 'pending',
          updated_at = now()
        where id = $1;
      `,
      [
        characterId,
        characterName,
        defaultWorld,
        lodestoneCharacterId,
        ffxivCollectCharacterId,
        authentikEmail,
        role,
        notes,
        active,
        mountWinNotificationsEnabled
      ]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function deleteCharacter(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to remove characters.");
  }

  const characterId = Number.parseInt(String(formData.get("characterId") ?? ""), 10);

  if (!Number.isFinite(characterId) || characterId <= 0) {
    throw new Error("Invalid character ID.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        delete from portal_characters
        where id = $1;
      `,
      [characterId]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06E: Mount management actions
// -------------------------

async function updateMountSettings(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to update mount settings.");
  }

  const mountId = Number.parseInt(String(formData.get("mountId") ?? ""), 10);
  const mountCategory = String(formData.get("mountCategory") ?? "Other").trim() || "Other";
  const farmPriority = String(formData.get("farmPriority") ?? "optional").trim() || "optional";
  const active = formData.get("active") === "on";

  if (!Number.isFinite(mountId) || mountId <= 0) {
    throw new Error("Invalid mount ID.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        update portal_mounts
        set
          mount_category = $2,
          farm_priority = $3,
          active = $4,
          manual_override = true,
          updated_at = now()
        where id = $1;
      `,
      [mountId, mountCategory, farmPriority, active]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06F: Mount win test actions
// -------------------------

async function createTestMountWin() {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to create test mount wins.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(`
      delete from portal_mount_acquisitions
      where is_test = true;
    `);

    await client.query(`
      insert into portal_mount_acquisitions (
        character_id,
        mount_id,
        character_name,
        mount_name,
        detected_at,
        is_test,
        discord_sent_at,
        discord_error
      )
      values (
        -999999,
        -999999,
        'Test Member',
        'Test Mount',
        now(),
        true,
        null,
        null
      );
    `);
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function cancelPendingMountWinNotificationsForCharacter(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to cancel mount-win notifications.");
  }

  const characterId = Number(formData.get("characterId"));
  if (!Number.isInteger(characterId) || characterId <= 0) {
    throw new Error("Choose a valid character before cancelling notifications.");
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `
        update portal_mount_acquisitions
        set
          discord_sent_at = now(),
          discord_error = 'Cancelled by officer before Discord delivery.'
        where character_id = $1
          and coalesce(is_test, false) = false
          and discord_sent_at is null;
      `,
      [characterId]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
async function clearTestMountWins() {
  "use server";

  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("You do not have permission to clear test mount wins.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(`
      delete from portal_mount_acquisitions
      where is_test = true;
    `);
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06G: Join date manager action
// -------------------------

async function updateCharacterJoinDate(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const canManageJoinDates =
    groups.includes("Admins") || groups.includes("Guild Officers");

  if (!canManageJoinDates) {
    throw new Error("Officer access is required.");
  }

  const characterId = Number.parseInt(String(formData.get("characterId") || ""), 10);
  const joinDate = String(formData.get("joinDate") || "").trim();
  const clearJoinDate = String(formData.get("clearJoinDate") || "") === "true";

  if (!Number.isFinite(characterId) || characterId <= 0) {
    throw new Error("A valid character is required.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    if (clearJoinDate) {
      await client.query(
        `
          update portal_characters
          set
            join_date_override = null,
            join_date_source = case
              when first_seen_in_fc_at is not null then 'first_seen'
              else 'unknown'
            end,
            updated_at = now()
          where id = $1;
        `,
        [characterId]
      );
    } else {
      if (!joinDate) {
        throw new Error("Join date is required.");
      }

      await client.query(
        `
          update portal_characters
          set
            join_date_override = $2::date,
            join_date_source = 'manual',
            updated_at = now()
          where id = $1;
        `,
        [characterId, joinDate]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06H: Discord bot settings action
// -------------------------

async function updateAltCharacterSettings(formData: FormData) {
  "use server";
  const session=(await auth()) as PortalSession;
  if(!hasAnyGroup(getUserGroupsFromSession(session),["Admins","Guild Officers"]))throw new Error("Officer access is required.");
  const defaultLimit=Number(formData.get("altCharacterDefaultLimit")||1);
  const expiry=Number(formData.get("altCharacterCodeExpiryMinutes")||60);
  const mode=String(formData.get("altCharacterVerificationMode")||"code_or_officer");
  if(!Number.isInteger(defaultLimit)||defaultLimit<0||defaultLimit>32)throw new Error("The default additional-character limit must be from 0 to 32.");
  if(!Number.isInteger(expiry)||expiry<10||expiry>1440)throw new Error("Code expiry must be from 10 to 1440 minutes.");
  if(!["code_or_officer","officer_only"].includes(mode))throw new Error("Choose a valid verification policy.");
  const client=await getDbClient();try{await ensurePortalSchema(client);const current=(await client.query(`select officer_log_channel_id from portal_discord_bot_settings where id=1`)).rows[0];if(String(formData.get("altCharacterClaimsEnabled")||"")==="on"&&mode==="officer_only"&&!String(current?.officer_log_channel_id||"").trim())throw new Error("Officer-only claims require an Officer Log Channel in Discord Bot Settings.");await client.query(`update portal_discord_bot_settings set alt_character_claims_enabled=$1,alt_character_default_limit=$2,alt_character_verification_mode=$3,alt_character_code_expiry_minutes=$4,updated_at=now() where id=1`,[String(formData.get("altCharacterClaimsEnabled")||"")==="on",defaultLimit,mode,expiry]);}finally{await client.end();}
  revalidatePath("/");
}

async function updateAltCharacterLimit(formData: FormData) {
  "use server";
  const session=(await auth()) as PortalSession;
  if(!hasAnyGroup(getUserGroupsFromSession(session),["Admins","Guild Officers"]))throw new Error("Officer access is required.");
  const discordUserId=String(formData.get("discordUserId")||"").trim();
  const raw=String(formData.get("maxAdditionalCharacters")||"").trim();
  if(!/^\d{15,22}$/.test(discordUserId))throw new Error("A valid Discord member is required.");
  const client=await getDbClient();try{await ensurePortalSchema(client);if(raw==="")await client.query(`delete from portal_alt_character_limits where discord_user_id=$1`,[discordUserId]);else{const limit=Number(raw);if(!Number.isInteger(limit)||limit<0||limit>32)throw new Error("The member limit must be from 0 to 32.");await client.query(`insert into portal_alt_character_limits(discord_user_id,max_additional_characters,updated_by_discord_user_id) values($1,$2,$3) on conflict(discord_user_id) do update set max_additional_characters=excluded.max_additional_characters,updated_by_discord_user_id=excluded.updated_by_discord_user_id,updated_at=now()`,[discordUserId,limit,String(session?.user?.discordUserId||"")]);}}finally{await client.end();}
  revalidatePath("/");
}

async function bindAltCharacterAsOfficer(formData:FormData){
  "use server";
  const session=(await auth()) as PortalSession;
  if(!hasAnyGroup(getUserGroupsFromSession(session),["Admins","Guild Officers"]))throw new Error("Officer access is required.");
  const discordUserId=String(formData.get("discordUserId")||"").trim(),characterId=Number(formData.get("characterId")||0);
  if(!/^\d{15,22}$/.test(discordUserId)||!Number.isInteger(characterId)||characterId<1)throw new Error("Choose a valid Discord member and character.");
  const client=await getDbClient();
  try{
    await ensurePortalSchema(client);
    await client.query("begin");
    try{
      await client.query(`select pg_advisory_xact_lock(hashtext($1))`,[`alt-character:${discordUserId}`]);
      const anchor=(await client.query(`select dl.character_id from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified') for share`,[discordUserId])).rows[0];
      if(!anchor)throw new Error("That Discord member does not have a current FC membership anchor.");
      if(Number(anchor.character_id)===characterId)throw new Error("The FC membership anchor does not need an additional-character link.");
      const state=(await client.query(`select coalesce(l.max_additional_characters,s.alt_character_default_limit)::int max_count,(select count(*)::int from portal_alt_character_links x where x.discord_user_id=$1 and x.active=true) active_count from portal_discord_bot_settings s left join portal_alt_character_limits l on l.discord_user_id=$1 where s.id=1`,[discordUserId])).rows[0];
      if(Number(state.active_count)>=Number(state.max_count))throw new Error(`That member has reached the limit of ${state.max_count} additional character(s).`);
      const character=(await client.query(`select id,fc_membership_status from portal_characters where id=$1 and lodestone_character_id is not null for update`,[characterId])).rows[0];
      if(!character)throw new Error("Choose a character with a Lodestone ID.");
      const owner=await client.query(`select discord_user_id from portal_alt_character_links where character_id=$1 and active=true and discord_user_id<>$2 union all select discord_user_id from portal_discord_links where character_id=$1 and discord_user_id<>$2`,[characterId,discordUserId]);
      if(owner.rows.length)throw new Error("That character is already linked to another Discord member.");
      await client.query(`insert into portal_alt_character_links(discord_user_id,character_id,verification_method,verified_by_discord_user_id) values($1,$2,'officer_bound',$3) on conflict(discord_user_id,character_id) do update set active=true,verification_method='officer_bound',verified_by_discord_user_id=excluded.verified_by_discord_user_id,verified_at=now(),updated_at=now()`,[discordUserId,characterId,String(session?.user?.discordUserId||"")]);
      await client.query(`update portal_characters set role='Alt',active=true,fc_membership_status=case when fc_membership_status='current' then 'current' else 'linked_external' end,sync_status=case when fc_membership_status='current' then sync_status else 'pending' end,updated_at=now() where id=$1`,[characterId]);
      await client.query("commit");
    }catch(error){await client.query("rollback");throw error;}
  }finally{await client.end();}
  revalidatePath("/");
}

async function updateDiscordBotSettings(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const canManageDiscordBot =
    groups.includes("Admins") || groups.includes("Guild Officers");

  if (!canManageDiscordBot) {
    throw new Error("Officer access is required.");
  }

  const clean = (key: string) => String(formData.get(key) || "").trim();
  const checked = (key: string) => String(formData.get(key) || "") === "on";

  const rosterScanIntervalHours = Math.max(
    1,
    Math.min(168, Number(formData.get("rosterScanIntervalHours") || 24))
  );
  const onboardingSelectionMinutes = Math.max(
    1,
    Math.min(1440, Number(formData.get("onboardingSelectionMinutes") || 30))
  );
  const requestedTempGuestHours = Number(formData.get("tempGuestHours") || 6);
  if (!Number.isInteger(requestedTempGuestHours) || requestedTempGuestHours < 1 || requestedTempGuestHours > 720) {
    throw new Error("Temporary guest duration must be a whole number from 1 to 720 hours.");
  }
  const tempGuestHours = requestedTempGuestHours;
  const temporaryGuestsEnabled = checked("temporaryGuestsEnabled");
  if (temporaryGuestsEnabled && !clean("tempAccessRoleId")) {
    throw new Error("Choose a temporary guest role or disable temporary guest access.");
  }
  const welcomeWaveStickerIds = [...new Set(clean("welcomeWaveStickerIds").split(/[\s,]+/).filter(Boolean))];
  if (welcomeWaveStickerIds.length > 50) throw new Error("A maximum of 50 welcome sticker IDs can be saved.");
  if (welcomeWaveStickerIds.some((stickerId) => !/^\d{15,22}$/.test(stickerId))) {
    throw new Error("Each welcome sticker ID must contain 15 to 22 digits.");
  }

  const currentSettings = await getDiscordBotSettings();
  const configuredGuildId = currentSettings.guild_id || String(process.env.DISCORD_GUILD_ID || "").trim();
  const resourceDiscovery = await getDiscordResourceDiscovery({ ...currentSettings, guild_id: configuredGuildId });
  const roleFields: Array<[string, string]> = [
    ["verifiedRoleId", currentSettings.verified_role_id],
    ["unverifiedRoleId", currentSettings.unverified_role_id],
    ["tempAccessRoleId", currentSettings.temp_access_role_id]
  ];
  const channelFields: Array<[string, string]> = [
    ["welcomeChannelId", currentSettings.welcome_channel_id],
    ["freeCompanyChatChannelId", currentSettings.free_company_chat_channel_id],
    ["officerLogChannelId", currentSettings.officer_log_channel_id],
    ["eventChannelId", currentSettings.event_channel_id],
    ["mountWinChannelId", currentSettings.mount_win_channel_id],
    ["craftingChannelId", currentSettings.crafting_channel_id],
    ["treasureMapChannelId", currentSettings.treasure_map_channel_id],
    ["testChannelId", currentSettings.test_channel_id],
    ["memberRenameNotificationChannelId", currentSettings.member_rename_notification_channel_id],
    ["gamingSetupsChannelId", currentSettings.gaming_setups_channel_id],
    ["petsGalleryChannelId", currentSettings.pets_gallery_channel_id],
    ["glamoursGalleryChannelId", currentSettings.glamours_gallery_channel_id],
    ["artworkGalleryChannelId", currentSettings.artwork_gallery_channel_id],
    ["giveawayChannelId", currentSettings.giveaway_channel_id],
    ["contestantsChannelId", currentSettings.contestants_channel_id],
    ["fashionReportChannelId", currentSettings.fashion_report_channel_id],
    ["animeRankingChannelId", currentSettings.anime_ranking_channel_id],
    ["lodestoneNewsChannelId", currentSettings.lodestone_news_channel_id]
  ];
  const validateResourceFields = (fields: Array<[string, string]>, allowed: DiscordResourceOption[], kind: string) => {
    const allowedIds = new Set(allowed.map((option) => option.id));
    for (const [field, currentValue] of fields) {
      const selectedValue = clean(field);
      if (!selectedValue || selectedValue === currentValue) continue;
      if (resourceDiscovery.error || !allowedIds.has(selectedValue)) {
        throw new Error(`The selected Discord ${kind} is not available to the bot. Refresh the choices and try again.`);
      }
    }
  };
  validateResourceFields(roleFields, resourceDiscovery.roles, "role");
  validateResourceFields(channelFields, resourceDiscovery.channels, "channel");

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        insert into portal_discord_bot_settings (
          id,
          guild_id,
          verified_role_id,
          unverified_role_id,
          welcome_channel_id,
          officer_log_channel_id,
          event_channel_id,
          raid_channel_id,
          mount_farm_channel_id,
          mount_win_channel_id,
          roster_review_channel_id,
          test_channel_id,
        member_rename_notification_channel_id,
          auto_rename_enabled,
          auto_role_enabled,
          startup_member_sync_enabled,
          log_unmatched_attempts,
          auto_roster_scan_enabled,
          roster_scan_interval_hours,
          crafting_channel_id,
          updated_at
        )
        values (
          1,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          now()
        )
        on conflict (id)
        do update set
          guild_id = excluded.guild_id,
          verified_role_id = excluded.verified_role_id,
          unverified_role_id = excluded.unverified_role_id,
          welcome_channel_id = excluded.welcome_channel_id,
          officer_log_channel_id = excluded.officer_log_channel_id,
          event_channel_id = excluded.event_channel_id,
          raid_channel_id = excluded.raid_channel_id,
          mount_farm_channel_id = excluded.mount_farm_channel_id,
          mount_win_channel_id = excluded.mount_win_channel_id,
          roster_review_channel_id = excluded.roster_review_channel_id,
          test_channel_id = excluded.test_channel_id,
          member_rename_notification_channel_id = excluded.member_rename_notification_channel_id,
          auto_rename_enabled = excluded.auto_rename_enabled,
          auto_role_enabled = excluded.auto_role_enabled,
          startup_member_sync_enabled = excluded.startup_member_sync_enabled,
          log_unmatched_attempts = excluded.log_unmatched_attempts,
          auto_roster_scan_enabled = excluded.auto_roster_scan_enabled,
          roster_scan_interval_hours = excluded.roster_scan_interval_hours,
          crafting_channel_id = excluded.crafting_channel_id,
          updated_at = now();
      `,
      [
        configuredGuildId,
        clean("verifiedRoleId"),
        clean("unverifiedRoleId"),
        clean("welcomeChannelId"),
        clean("officerLogChannelId"),
        clean("eventChannelId"),
        "",
        "",
        clean("mountWinChannelId"),
        currentSettings.roster_review_channel_id,
        clean("testChannelId"),
        clean("memberRenameNotificationChannelId"),
        checked("autoRenameEnabled"),
        checked("autoRoleEnabled"),
        checked("startupMemberSyncEnabled"),
        checked("logUnmatchedAttempts"),
        checked("autoRosterScanEnabled"),
        rosterScanIntervalHours,
        clean("craftingChannelId")
      ]
    );

    await client.query(
      `update portal_discord_bot_settings
       set gaming_setups_channel_id = $1,
           pets_gallery_channel_id = $2,
           glamours_gallery_channel_id = $3,
           artwork_gallery_channel_id = $4,
           giveaway_channel_id = $5,
           contestants_channel_id = $6,
           rename_notifications_discord_members_enabled = $7,
           rename_notifications_non_discord_members_enabled = $8,
           notification_window_enabled = $9,
           notification_window_start_time = $10,
           notification_window_end_time = $11,
           fashion_report_channel_id = $12,
           fashion_report_enabled = $13,
           anime_ranking_channel_id = $14,
           anime_ranking_enabled = $15,
           anime_ranking_thread_enabled = $16,
           lodestone_news_channel_id = $17,
           lodestone_news_enabled = $18,
           updated_at = now()
       where id = 1;`,
      [
        clean("gamingSetupsChannelId"),
        clean("petsGalleryChannelId"),
        clean("glamoursGalleryChannelId"),
        clean("artworkGalleryChannelId"),
        clean("giveawayChannelId"),
        clean("contestantsChannelId"),
        checked("renameNotificationsDiscordMembersEnabled"),
        checked("renameNotificationsNonDiscordMembersEnabled"),
        checked("notificationWindowEnabled"),
        clean("notificationWindowStartTime") || "08:00",
        clean("notificationWindowEndTime") || "22:00",
        clean("fashionReportChannelId"),
        checked("fashionReportEnabled"),
        clean("animeRankingChannelId"),
        checked("animeRankingEnabled"),
        checked("animeRankingThreadEnabled"),
        clean("lodestoneNewsChannelId"),
        checked("lodestoneNewsEnabled")
      ]
    );

    await client.query(
      `update portal_discord_bot_settings
       set temporary_guest_enabled = $1,
           temp_access_role_id = $2,
           onboarding_selection_minutes = $3,
           temp_guest_hours = $4,
           free_company_chat_channel_id = $5,
           welcome_wave_sticker_ids = $6,
           welcome_engagement_enabled = $7,
           updated_at = now()
       where id = 1;`,
      [
        temporaryGuestsEnabled,
        clean("tempAccessRoleId"),
        onboardingSelectionMinutes,
        tempGuestHours,
        clean("freeCompanyChatChannelId"),
        welcomeWaveStickerIds.join(","),
        checked("welcomeEngagementEnabled")
      ]
    );

    await client.query(
      `update portal_discord_bot_settings
       set mount_win_announcements_enabled = $1,
           anime_event_scheduling_enabled = $2,
           updated_at = now()
       where id = 1;`,
      [checked("mountWinAnnouncementsEnabled"), checked("animeEventSchedulingEnabled")]
    );

    await client.query(
      `update portal_discord_bot_settings
       set treasure_map_channel_id = $1,
           treasure_map_auto_enabled = $2,
           updated_at = now()
       where id = 1;`,
      [clean("treasureMapChannelId"), checked("treasureMapAutoEnabled")]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// -------------------------
// SUBSECTION 06H1: Community gallery review and historical imports
// -------------------------

async function requestCommunityGalleryImport(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  const category = String(formData.get("category") || "").trim();
  if (category !== "gaming_setup" && category !== "pet" && category !== "glamour" && category !== "artwork") {
    throw new Error("Choose a valid community gallery.");
  }
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`
      insert into portal_community_gallery_import_requests (category, requested_by, requested_at, status, scanned_messages, imported_posts, completed_at, error_text)
      values ($1, $2, now(), 'pending', 0, 0, null, null)
      on conflict (category) do update set
        requested_by = excluded.requested_by,
        requested_at = now(),
        status = 'pending',
        scanned_messages = 0,
        imported_posts = 0,
        completed_at = null,
        error_text = null;
    `, [category, String(session?.user?.name || session?.user?.email || "Officer")]);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function saveCommunityGalleryDisplayName(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  const postId = Number.parseInt(String(formData.get("postId") || ""), 10);
  const displayName = String(formData.get("displayName") || "").trim();
  if (!Number.isFinite(postId) || postId <= 0) {
    throw new Error("Choose a valid gallery post.");
  }
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`
      update portal_community_gallery_posts
      set display_name_override = nullif($2, ''), updated_at = now()
      where id = $1;
    `, [postId, displayName]);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function reviewCommunityGalleryPost(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  const postId = Number.parseInt(String(formData.get("postId") || ""), 10);
  const decision = String(formData.get("decision") || "").trim();
  if (!Number.isFinite(postId) || postId <= 0 || !["approved", "rejected"].includes(decision)) {
    throw new Error("Choose a valid gallery review decision.");
  }
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`
      update portal_community_gallery_posts
      set review_status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
      where id = $1;
    `, [postId, decision, String(session?.user?.name || session?.user?.email || "Officer")]);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
// SUBSECTION 06H2: Officer verified-link reassignment
// -------------------------

async function reassignVerifiedDiscordLinkLegacy(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("You do not have permission to reassign verified Discord links.");
  const discordUserId = String(formData.get("discordUserId") ?? "").trim();
  const targetCharacterId = Number.parseInt(String(formData.get("targetCharacterId") ?? ""), 10);
  if (!discordUserId || !Number.isFinite(targetCharacterId) || targetCharacterId <= 0) throw new Error("Choose a verified Discord member and a current FC character.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await assertFcOwnershipVerified(client);
    await client.query("begin");
    const linkResult = await client.query<{ discord_user_id: string; discord_username: string | null; discord_global_name: string | null; discord_nickname: string | null; discord_display_name: string | null; character_id: number | null; character_name: string | null; }>(`
      select dl.discord_user_id, dl.discord_username, dl.discord_global_name, dl.discord_nickname, dl.discord_display_name, dl.character_id::int, c.character_name
      from portal_discord_links dl left join portal_characters c on c.id = dl.character_id
      where dl.discord_user_id = $1 for update of dl;`, [discordUserId]);
    const link = linkResult.rows[0];
    if (!link) throw new Error("That verified Discord link could not be found.");
    const targetResult = await client.query<{ id: number; character_name: string; world: string }>(`
      select id::int, character_name, world from portal_characters
      where id = $1 and active = true and fc_membership_status = 'current' for share;`, [targetCharacterId]);
    const target = targetResult.rows[0];
    if (!target) throw new Error("The new character must be an active, current FC member.");
    if (link.character_id === target.id) throw new Error("That Discord account is already linked to this character.");
    const conflict = await client.query<{ discord_user_id: string }>(`select discord_user_id from portal_discord_links where character_id = $1 and discord_user_id <> $2 limit 1;`, [target.id, discordUserId]);
    if (conflict.rows[0]) throw new Error("That character is already linked to a different Discord account. Resolve that existing link first.");
    await client.query(`update portal_discord_links set character_id=$1, match_source='officer_reassigned', matched_at=now(), updated_at=now() where discord_user_id=$2;`, [target.id, discordUserId]);
    await client.query(`insert into portal_discord_audit_log (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,submitted_character_name,character_id,attempt_type,result,reason,details,created_at) values ($1,$2,$3,$4,$5,$6,$7,'officer_reassign','matched',$8,$9::jsonb,now());`, [
      link.discord_user_id, link.discord_username, link.discord_global_name, link.discord_nickname, link.discord_display_name, target.character_name, target.id,
      `Officer reassigned verified Discord link from ${link.character_name || "an unlinked character"} to ${target.character_name}.`,
      JSON.stringify({ previousCharacterId: link.character_id, previousCharacterName: link.character_name, targetCharacterId: target.id, targetCharacterName: target.character_name, changedByDiscordUserId: String(session?.user?.discordUserId ?? "").trim() || null })
    ]);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
  revalidatePath("/");
}
// SUBSECTION 06I: Discord roster review decision action
// -------------------------

async function updateDiscordRosterReviewDecision(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const canReviewRoster =
    groups.includes("Admins") || groups.includes("Guild Officers");

  if (!canReviewRoster) {
    throw new Error("Officer access is required.");
  }

  const discordUserId = String(formData.get("discordUserId") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const note = String(formData.get("note") || "").trim();

  const allowedDecisions = new Set([
    "guest_ignore",
    "kick_review",
    "review",
    "clear"
  ]);

  if (!discordUserId) {
    throw new Error("Discord user ID is required.");
  }

  if (!allowedDecisions.has(decision)) {
    throw new Error("Invalid roster review decision.");
  }

  const decidedBy =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    if (decision !== "clear") await assertFcOwnershipVerified(client);

    if (decision === "clear") {
      await client.query(
        `
          delete from portal_discord_roster_review_decisions
          where discord_user_id = $1;
        `,
        [discordUserId]
      );
    } else {
      await client.query(
        `
          insert into portal_discord_roster_review_decisions (
            discord_user_id,
            decision,
            note,
            decided_by,
            decided_at,
            updated_at
          )
          values ($1, $2, $3, $4, now(), now())
          on conflict (discord_user_id)
          do update set
            decision = excluded.decision,
            note = excluded.note,
            decided_by = excluded.decided_by,
            decided_at = now(),
            updated_at = now();
        `,
        [discordUserId, decision, note, decidedBy]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06J: Discord roster review test actions
// -------------------------

async function createTestDiscordRosterReview() {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const testDiscordUserId = "cotf-test-roster-review";
  const testCharacterName = "COTF Test Former Member";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query("begin");

    const characterResult = await client.query(
      `
        insert into portal_characters (
          display_name,
          character_name,
          world,
          role,
          active,
          fc_membership_status,
          sync_status,
          notes,
          first_seen_in_fc_at,
          last_seen_in_fc_at,
          join_date_source,
          updated_at,
          (select count(*)::int from portal_alt_character_links acl where acl.discord_user_id=(select dl.discord_user_id from portal_discord_links dl where dl.character_id=portal_characters.id limit 1) and acl.active=true) linked_character_count
        )
        values (
          $1,
          $1,
          $2,
          'Member',
          false,
          'former',
          'test',
          'Synthetic test record for Discord roster review.',
          now() - interval '30 days',
          now() - interval '7 days',
          'manual',
          now()
        )
        returning id;
      `,
      [testCharacterName, defaultWorld]
    );

    const characterId = Number(characterResult.rows[0].id);

    await client.query(
      `
        insert into portal_discord_links (
          discord_user_id,
          discord_username,
          discord_global_name,
          discord_nickname,
          discord_display_name,
          character_id,
          match_source,
          matched_at,
          last_seen_at,
          updated_at
        )
        values (
          $1,
          'cotf-test-user',
          'COTF Test User',
          'COTF Test User',
          'COTF Test User',
          $2,
          'test',
          now() - interval '14 days',
          now(),
          now()
        )
        on conflict (discord_user_id)
        do update set
          discord_username = excluded.discord_username,
          discord_global_name = excluded.discord_global_name,
          discord_nickname = excluded.discord_nickname,
          discord_display_name = excluded.discord_display_name,
          character_id = excluded.character_id,
          match_source = excluded.match_source,
          matched_at = excluded.matched_at,
          last_seen_at = excluded.last_seen_at,
          updated_at = now();
      `,
      [testDiscordUserId, characterId]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function clearTestDiscordRosterReview() {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const testDiscordUserId = "cotf-test-roster-review";
  const testCharacterName = "COTF Test Former Member";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query("begin");

    const linkResult = await client.query(
      `
        select character_id
        from portal_discord_links
        where discord_user_id = $1;
      `,
      [testDiscordUserId]
    );

    await client.query(
      `
        delete from portal_discord_roster_review_decisions
        where discord_user_id = $1;
      `,
      [testDiscordUserId]
    );

    await client.query(
      `
        delete from portal_discord_links
        where discord_user_id = $1;
      `,
      [testDiscordUserId]
    );

    for (const row of linkResult.rows) {
      if (row.character_id) {
        await client.query(
          `
            delete from portal_characters
            where id = $1
              and character_name = $2
              and notes = 'Synthetic test record for Discord roster review.';
          `,
          [row.character_id, testCharacterName]
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function queueTestMountWin(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const mountId = Number(formData.get("mountWinTestMountId") || 0);
  const winnerNames = Array.from(
    new Set(
      String(formData.get("mountWinTestWinnerNames") || "")
        .split(/[\n,]+/)
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ).slice(0, 25);
  if (!Number.isFinite(mountId) || mountId <= 0) {
    throw new Error("Choose a mount for the test post.");
  }
  if (!winnerNames.length) {
    throw new Error("Enter at least one character name for the test post.");
  }

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const mountResult = await client.query<PortalMountWinTestOption>(
      `
        select m.id::int, m.mount_name, m.source_name, m.image_url, m.icon_url,
               ms.name as set_name, ms.expansion
        from portal_mounts m
        left join portal_mount_sets ms on ms.id = m.mount_set_id
        where m.id = $1 and m.active = true
        limit 1;
      `,
      [mountId]
    );
    const mount = mountResult.rows[0];
    if (!mount) throw new Error("That mount is not available for a test post.");

    const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
    const payload = JSON.stringify({
      mountName: mount.mount_name,
      sourceName: mount.source_name,
      imageUrl: mount.image_url || mount.icon_url || null,
      setName: mount.set_name,
      expansion: mount.expansion,
      winnerNames
    });
    await client.query(
      `
        insert into portal_discord_action_queue (
          discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at
        )
        values ('__mount_win_test__', 'send_test_mount_win', $1::jsonb, 'pending', $2, now(), now())
        on conflict (discord_user_id, action_type)
        where status = 'pending'
        do update set
          action_payload = excluded.action_payload,
          requested_by = excluded.requested_by,
          requested_at = now(),
          updated_at = now();
      `,
      [payload, requestedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
// -------------------------
// SUBSECTION 06K: Discord action queue action
// -------------------------

async function getProtectedPortalAdministratorIds(client: Client) {
  const protectedIds = new Set(installationPrimaryAdminDiscordId ? [installationPrimaryAdminDiscordId] : []);
  const result = await client.query<{ value: string }>("select value from portal_settings where key = 'additionalAdminDiscordIds' limit 1;");
  String(result.rows[0]?.value || "").split(",").map((value) => value.trim()).filter(Boolean).forEach((value) => protectedIds.add(value));
  return protectedIds;
}

async function minimizeMyPortalData(formData: FormData) {
  "use server";
  if (String(formData.get("confirmation") || "").trim() !== "MINIMIZE") throw new Error("Type MINIMIZE to confirm verification-only mode.");
  const session = (await auth()) as PortalSession;
  const character = await requireEligibleMemberCharacter(session);
  const discordUserId = String(session?.user?.discordUserId ?? "").trim();
  if (!discordUserId) throw new Error("A verified Discord identity is required.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await minimizePrivacySubject(client,{discordUserId,characterId:character.id,label:character.character_name},"member_self_service");
  } finally { await client.end(); }
  revalidatePath("/");
  redirect("/?view=settings#data-privacy");
}

async function fullyOptOutMyPortalData(formData: FormData) {
  "use server";
  if (String(formData.get("confirmation") || "").trim() !== "DELETE MY PORTAL DATA") throw new Error("Type DELETE MY PORTAL DATA exactly to confirm.");
  const session = (await auth()) as PortalSession;
  const character = await requireEligibleMemberCharacter(session);
  const discordUserId = String(session?.user?.discordUserId ?? "").trim();
  if (!discordUserId) throw new Error("A verified Discord identity is required.");
  const configuredAdmins=String(process.env.PORTAL_ADMIN_DISCORD_IDS||"").split(",").map((value)=>value.trim()).filter(Boolean);
  const primaryAdminId=String(process.env.PORTAL_PRIMARY_ADMIN_DISCORD_ID||configuredAdmins[0]||"").trim();
  if(discordUserId===primaryAdminId)throw new Error("The primary portal officer cannot opt out. Transfer the primary-officer configuration first.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const adminRow=await client.query<{value:string}>("select value from portal_settings where key='additionalAdminDiscordIds' limit 1");
    const remaining=String(adminRow.rows[0]?.value||"").split(",").map((value)=>value.trim()).filter((value)=>value&&value!==discordUserId);
    await client.query(`insert into portal_settings(key,value,updated_at) values('additionalAdminDiscordIds',$1,now()) on conflict(key) do update set value=excluded.value,updated_at=now()`,[remaining.join(",")]);
    await erasePrivacySubject(client,{discordUserId,characterId:character.id,label:character.character_name},"member_self_service","Member completed the full opt-out confirmation.");
  } finally { await client.end(); }
  await signOut({ redirectTo: "/" });
}

async function assignDiscordCharacterLink(
  formData: FormData,
  mode: "bind" | "reassign"
): Promise<DiscordLinkAssignmentState> {
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    return { status: "error", message: "Officer access is required." };
  }

  const discordUserId = String(formData.get("discordUserId") || "").trim();
  const targetField = mode === "reassign" ? "targetCharacterId" : "characterId";
  const targetCharacterId = Number.parseInt(String(formData.get(targetField) || ""), 10);
  const resolveConflict = String(formData.get("resolveConflict") || "") === "clear_and_assign";
  const transferVerifiedRole = String(formData.get("transferVerifiedRole") || "") === "true";
  const expectedConflictDiscordUserId = String(formData.get("expectedConflictDiscordUserId") || "").trim();
  if (!/^\d{15,22}$/.test(discordUserId) || !Number.isFinite(targetCharacterId) || targetCharacterId <= 0) {
    return { status: "error", message: "Choose a Discord member and an active, current FC character." };
  }

  const client = await getDbClient();
  let transactionOpen = false;
  let result: DiscordLinkAssignmentState = { status: "error", message: "The character link could not be saved." };
  try {
    await ensurePortalSchema(client);
    await assertFcOwnershipVerified(client);
    await client.query("begin");
    transactionOpen = true;

    if (await isPrivacySuppressed(client, discordUserId)) {
      await client.query("rollback");
      transactionOpen = false;
      return { status: "error", message: "That member has opted out. They must personally choose Opt In and Re-verify before an officer can create a new link." };
    }

    const requestedResult = mode === "reassign"
      ? await client.query<PortalDiscordLink>("select dl.discord_user_id, dl.discord_username, dl.discord_global_name, dl.discord_nickname, dl.discord_display_name, dl.character_id::int, c.character_name, c.world, c.role, dl.match_source, dl.matched_at, dl.last_seen_at from portal_discord_links dl left join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 for update of dl;", [discordUserId])
      : await client.query<PortalDiscordMemberSnapshotReview>("select * from portal_discord_member_snapshots where discord_user_id=$1 and present_in_guild=true and is_bot=false for update;", [discordUserId]);
    const requested = requestedResult.rows[0];
    if (!requested) {
      throw new Error(mode === "reassign" ? "That verified Discord link could not be found." : "That Discord member is not present in the latest server scan.");
    }
    const previousCharacterId = mode === "reassign"
      ? (requested as PortalDiscordLink).character_id
      : (requested as PortalDiscordMemberSnapshotReview).linked_character_id;

    const targetResult = await client.query<{ id: number; character_name: string; world: string }>("select id::int, character_name, world from portal_characters where id=$1 and active=true and fc_membership_status='current' for share;", [targetCharacterId]);
    const target = targetResult.rows[0];
    if (!target) throw new Error("Choose an active character currently in the FC.");
    if (mode === "reassign" && previousCharacterId === target.id) {
      throw new Error("That Discord account is already linked to this character.");
    }

    const conflictResult = await client.query<{
      discord_user_id: string;
      discord_username: string | null;
      discord_global_name: string | null;
      discord_nickname: string | null;
      discord_display_name: string | null;
    }>("select discord_user_id, discord_username, discord_global_name, discord_nickname, discord_display_name from portal_discord_links where character_id=$1 and discord_user_id<>$2 limit 1 for update;", [target.id, discordUserId]);
    const conflict = conflictResult.rows[0];
    const requestedDiscordName = requested.discord_display_name || requested.discord_nickname || requested.discord_global_name || requested.discord_username || requested.discord_user_id;

    if (conflict && !resolveConflict) {
      const existingDiscordName = conflict.discord_display_name || conflict.discord_nickname || conflict.discord_global_name || conflict.discord_username || conflict.discord_user_id;
      await client.query("rollback");
      transactionOpen = false;
      return {
        status: "conflict",
        message: "That character is already linked to another Discord account.",
        conflict: {
          characterName: target.character_name,
          targetCharacterId: target.id,
          existingDiscordUserId: conflict.discord_user_id,
          existingDiscordName,
          requestedDiscordUserId: requested.discord_user_id,
          requestedDiscordName
        }
      };
    }

    if (conflict && resolveConflict) {
      if (!expectedConflictDiscordUserId || conflict.discord_user_id !== expectedConflictDiscordUserId) {
        throw new Error("The conflicting link changed after the confirmation opened. Please try again.");
      }
      await client.query("delete from portal_discord_links where discord_user_id=$1 and character_id=$2;", [conflict.discord_user_id, target.id]);
      await client.query("update portal_discord_member_snapshots set linked_character_id=null, linked_character_name=null, linked_world=null, linked_fc_status=null, linked_active=null, review_status=case when present_in_guild=true and has_verified_role=true then 'needs_review' else 'ok' end, review_reason=case when present_in_guild=true and has_verified_role=true then 'Verified Discord user has no linked FC character.' else null end, updated_at=now() where discord_user_id=$1;", [conflict.discord_user_id]);
      await client.query("insert into portal_discord_audit_log (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,submitted_character_name,character_id,attempt_type,result,reason,details,created_at) values ($1,$2,$3,$4,$5,$6,$7,'officer_conflict_clear','matched',$8,$9::jsonb,now());", [
        conflict.discord_user_id,
        conflict.discord_username,
        conflict.discord_global_name,
        conflict.discord_nickname,
        conflict.discord_display_name,
        target.character_name,
        target.id,
        "Officer cleared a conflicting Discord link before assigning " + target.character_name + " to " + requestedDiscordName + ".",
        JSON.stringify({ replacementDiscordUserId: requested.discord_user_id, changedByDiscordUserId: String(session?.user?.discordUserId || "").trim() || null })
      ]);
    }

    const matchSource = mode === "reassign" ? "officer_reassigned" : "officer_bound";
    await client.query("insert into portal_discord_links (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,character_id,match_source,matched_at,last_seen_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,now(),now(),now()) on conflict (discord_user_id) do update set discord_username=excluded.discord_username,discord_global_name=excluded.discord_global_name,discord_nickname=excluded.discord_nickname,discord_display_name=excluded.discord_display_name,character_id=excluded.character_id,match_source=excluded.match_source,matched_at=now(),last_seen_at=now(),updated_at=now();", [
      requested.discord_user_id,
      requested.discord_username,
      requested.discord_global_name,
      requested.discord_nickname,
      requested.discord_display_name,
      target.id,
      matchSource
    ]);
    await client.query("update portal_discord_member_snapshots set linked_character_id=$2,linked_character_name=$3,linked_world=$4,linked_fc_status='current',linked_active=true,review_status='ok',review_reason=null,updated_at=now() where discord_user_id=$1;", [requested.discord_user_id, target.id, target.character_name, target.world]);
    await client.query("insert into portal_discord_audit_log (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,submitted_character_name,character_id,attempt_type,result,reason,details,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,'matched',$9,$10::jsonb,now());", [
      requested.discord_user_id,
      requested.discord_username,
      requested.discord_global_name,
      requested.discord_nickname,
      requested.discord_display_name,
      target.character_name,
      target.id,
      mode === "reassign" ? "officer_reassign" : "officer_bind",
      "Officer " + (mode === "reassign" ? "reassigned" : "bound") + " Discord member to " + target.character_name + ".",
      JSON.stringify({ previousCharacterId: previousCharacterId || null, targetCharacterId: target.id, clearedConflictingDiscordUserId: conflict?.discord_user_id || null, changedByDiscordUserId: String(session?.user?.discordUserId || "").trim() || null })
    ]);

    if (conflict && transferVerifiedRole) {
      const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
      await client.query("insert into portal_discord_action_queue (discord_user_id,action_type,action_payload,status,requested_by,requested_at,updated_at) values ($1,'remove_verified_role',$2::jsonb,'pending',$3,now(),now()) on conflict (discord_user_id,action_type) where status='pending' do update set action_payload=excluded.action_payload,requested_by=excluded.requested_by,requested_at=now(),updated_at=now();", [
        conflict.discord_user_id,
        JSON.stringify({ note: "Verified role transfer after an officer resolved a character-link conflict." }),
        requestedBy
      ]);
      await client.query("insert into portal_discord_action_queue (discord_user_id,action_type,action_payload,status,requested_by,requested_at,updated_at) values ($1,'apply_verified_state',$2::jsonb,'pending',$3,now(),now()) on conflict (discord_user_id,action_type) where status='pending' do update set action_payload=excluded.action_payload,requested_by=excluded.requested_by,requested_at=now(),updated_at=now();", [
        requested.discord_user_id,
        JSON.stringify({ note: "Apply verified state after an officer resolved a character-link conflict." }),
        requestedBy
      ]);
    }

    await client.query("commit");
    transactionOpen = false;
    result = {
      status: "success",
      message: target.character_name + " is now linked to " + requestedDiscordName + (conflict && transferVerifiedRole ? ". The Verified-role transfer was queued for the bot." : ".")
    };
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    result = { status: "error", message: error instanceof Error ? error.message : "The character link could not be saved." };
  } finally {
    await client.end();
  }

  revalidatePath("/");
  return result;
}

async function reassignVerifiedDiscordLink(
  _previousState: DiscordLinkAssignmentState,
  formData: FormData
): Promise<DiscordLinkAssignmentState> {
  "use server";
  return assignDiscordCharacterLink(formData, "reassign");
}

async function bindDiscordMemberCharacter(
  _previousState: DiscordLinkAssignmentState,
  formData: FormData
): Promise<DiscordLinkAssignmentState> {
  "use server";
  return assignDiscordCharacterLink(formData, "bind");
}

async function bindDiscordMemberCharacterLegacy(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const discordUserId = String(formData.get("discordUserId") || "").trim();
  const characterId = Number.parseInt(String(formData.get("characterId") || ""), 10);
  if (!/^\d{15,22}$/.test(discordUserId) || !Number.isFinite(characterId) || characterId <= 0) throw new Error("Choose a Discord member and a current FC character.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await assertFcOwnershipVerified(client);
    await client.query("begin");
    const snapshotResult = await client.query<PortalDiscordMemberSnapshotReview>(`select * from portal_discord_member_snapshots where discord_user_id=$1 and present_in_guild=true and is_bot=false for update;`, [discordUserId]);
    const snapshot = snapshotResult.rows[0];
    if (!snapshot) throw new Error("That Discord member is not present in the latest server scan.");
    const characterResult = await client.query<{ id: number; character_name: string; world: string }>(`select id::int,character_name,world from portal_characters where id=$1 and active=true and fc_membership_status='current' for share;`, [characterId]);
    const character = characterResult.rows[0];
    if (!character) throw new Error("Choose an active character currently in the FC.");
    const conflict = await client.query<{ discord_user_id: string }>(`select discord_user_id from portal_discord_links where character_id=$1 and discord_user_id<>$2 limit 1;`, [characterId, discordUserId]);
    if (conflict.rows[0]) throw new Error("That character is already linked to another Discord account.");
    await client.query(`insert into portal_discord_links (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,character_id,match_source,matched_at,last_seen_at,updated_at) values ($1,$2,$3,$4,$5,$6,'officer_bound',now(),now(),now()) on conflict (discord_user_id) do update set discord_username=excluded.discord_username,discord_global_name=excluded.discord_global_name,discord_nickname=excluded.discord_nickname,discord_display_name=excluded.discord_display_name,character_id=excluded.character_id,match_source=excluded.match_source,matched_at=now(),last_seen_at=now(),updated_at=now();`, [discordUserId, snapshot.discord_username, snapshot.discord_global_name, snapshot.discord_nickname, snapshot.discord_display_name, characterId]);
    await client.query(`update portal_discord_member_snapshots set linked_character_id=$2,linked_character_name=$3,linked_world=$4,linked_fc_status='current',linked_active=true,review_status='ok',review_reason=null,updated_at=now() where discord_user_id=$1;`, [discordUserId, characterId, character.character_name, character.world]);
    await client.query(`insert into portal_discord_audit_log (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,submitted_character_name,character_id,attempt_type,result,reason,details,created_at) values ($1,$2,$3,$4,$5,$6,$7,'officer_bind','matched',$8,$9::jsonb,now());`, [discordUserId, snapshot.discord_username, snapshot.discord_global_name, snapshot.discord_nickname, snapshot.discord_display_name, character.character_name, characterId, `Officer bound Discord member to ${character.character_name}.`, JSON.stringify({ changedByDiscordUserId: String(session?.user?.discordUserId || "").trim() || null })]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function queueDiscordRosterAction(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const discordUserId = String(formData.get("discordUserId") || "").trim();
  const actionType = String(formData.get("actionType") || "").trim();
  const note = String(formData.get("note") || "").trim();

  const allowedActions = new Set([
    "remove_verified_role",
    "add_unverified_role",
    "send_officer_alert",
    "kick_member"
  ]);

  if (!discordUserId) {
    throw new Error("Discord user ID is required.");
  }

  if (!allowedActions.has(actionType)) {
    throw new Error("Invalid Discord action.");
  }

  const requestedBy =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    await assertFcOwnershipVerified(client);

    const protectedAdministratorIds = await getProtectedPortalAdministratorIds(client);
    if (protectedAdministratorIds.has(discordUserId) && ["remove_verified_role", "add_unverified_role", "kick_member"].includes(actionType)) {
      throw new Error("Portal administrators are protected from destructive roster actions. Bind a current FC character or send an officer alert instead.");
    }

    const payloadJson = JSON.stringify({ note });

    if (actionType === "kick_member") {
      const updateResult = await client.query(
        `
          update portal_discord_action_queue
          set
            action_payload = $3::jsonb,
            status = 'needs_confirmation',
            requested_by = $4,
            requested_at = now(),
            picked_at = null,
            completed_at = null,
            result_message = 'Kick requires second officer confirmation before the bot acts.',
            error_message = null,
            updated_at = now()
          where discord_user_id = $1
            and action_type = $2
            and status in ('needs_confirmation', 'pending', 'processing', 'failed')
          returning id;
        `,
        [discordUserId, actionType, payloadJson, requestedBy]
      );

      if (updateResult.rowCount === 0) {
        await client.query(
          `
            insert into portal_discord_action_queue (
              discord_user_id,
              action_type,
              action_payload,
              status,
              requested_by,
              requested_at,
              result_message,
              updated_at
            )
            values (
              $1,
              $2,
              $3::jsonb,
              'needs_confirmation',
              $4,
              now(),
              'Kick requires second officer confirmation before the bot acts.',
              now()
            );
          `,
          [discordUserId, actionType, payloadJson, requestedBy]
        );
      }
    } else {
      await client.query(
        `
          insert into portal_discord_action_queue (
            discord_user_id,
            action_type,
            action_payload,
            status,
            requested_by,
            requested_at,
            updated_at
          )
          values ($1, $2, $3::jsonb, 'pending', $4, now(), now())
          on conflict (discord_user_id, action_type)
          where status = 'pending'
          do update set
            action_payload = excluded.action_payload,
            requested_by = excluded.requested_by,
            requested_at = now(),
            updated_at = now();
        `,
        [discordUserId, actionType, payloadJson, requestedBy]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

// -------------------------
// SUBSECTION 06L: Discord action queue management
// -------------------------

async function manageDiscordQueuedAction(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const actionId = Number(formData.get("actionId"));
  const queueAction = String(formData.get("queueAction") || "").trim();

  if (!Number.isFinite(actionId) || actionId <= 0) {
    throw new Error("Valid action ID is required.");
  }

  const allowedQueueActions = new Set(["retry", "cancel", "clear", "confirm_kick"]);

  if (!allowedQueueActions.has(queueAction)) {
    throw new Error("Invalid queue management action.");
  }

  const officerName =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    if (["retry", "confirm_kick"].includes(queueAction)) await assertFcOwnershipVerified(client);

    if (queueAction === "retry") {
      await client.query(
        `
          update portal_discord_action_queue
          set
            status = 'pending',
            picked_at = null,
            completed_at = null,
            result_message = null,
            error_message = null,
            updated_at = now()
          where id = $1
            and status in ('failed', 'processing');
        `,
        [actionId]
      );
    }

    if (queueAction === "confirm_kick") {
      await client.query(
        `
          update portal_discord_action_queue
          set
            status = 'pending',
            picked_at = null,
            completed_at = null,
            result_message = $2,
            error_message = null,
            action_payload = action_payload || jsonb_build_object(
              'confirmedBy', $3::text,
              'confirmedAt', now()::text
            ),
            updated_at = now()
          where id = $1
            and action_type = 'kick_member'
            and status = 'needs_confirmation';
        `,
        [actionId, `Kick confirmed by ${officerName}. Waiting for bot.`, officerName]
      );
    }

    if (queueAction === "cancel") {
      await client.query(
        `
          update portal_discord_action_queue
          set
            status = 'cancelled',
            completed_at = now(),
            result_message = $2,
            error_message = null,
            updated_at = now()
          where id = $1
            and status in ('needs_confirmation', 'pending', 'processing', 'failed');
        `,
        [actionId, `Cancelled by ${officerName}.`]
      );
    }

    if (queueAction === "clear") {
      await client.query(
        `
          update portal_discord_action_queue
          set
            status = 'archived',
            archived_at = now(),
            archived_by = $2,
            updated_at = now()
          where id = $1
            and status in ('completed', 'failed', 'cancelled');
        `,
        [actionId, officerName]
      );
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function clearAllDiscordActionHistory() {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const archivedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    await client.query(
      `
        update portal_discord_action_queue
        set
          status = 'archived',
          archived_at = now(),
          archived_by = $1,
          updated_at = now()
        where status in ('completed', 'failed', 'cancelled');
      `,
      [archivedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function queueFcRosterScan() {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(
      `insert into portal_worker_requests (request_type, status, requested_by, requested_at)
       values ('fc_roster_scan', 'pending', $1, now())
       on conflict (request_type) where status = 'pending'
       do update set requested_by = excluded.requested_by, requested_at = now();`,
      [requestedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function queueFcVerificationCheck() {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const verification = (await client.query("select status from portal_fc_verification where id=1 limit 1")).rows[0];
    if (verification?.status === "verified") {
      throw new Error("Free Company ownership is already verified.");
    }
    await client.query(
      `insert into portal_worker_requests (request_type, status, requested_by, requested_at)
       values ('fc_verification_check', 'pending', $1, now())
       on conflict (request_type) where status = 'pending'
       do update set requested_by = excluded.requested_by, requested_at = now();`,
      [requestedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function queueDiscordRosterScan(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const note = String(formData.get("note") || "").trim();
  const requestedBy =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        insert into portal_discord_action_queue (
          discord_user_id,
          action_type,
          action_payload,
          status,
          requested_by,
          requested_at,
          updated_at
        )
        values (
          '__guild_roster_scan__',
          'scan_discord_roster',
          $1::jsonb,
          'pending',
          $2,
          now(),
          now()
        )
        on conflict (discord_user_id, action_type)
        where status = 'pending'
        do update set
          action_payload = excluded.action_payload,
          requested_by = excluded.requested_by,
          requested_at = now(),
          updated_at = now();
      `,
      [JSON.stringify({ note }), requestedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function queueDiscordNameMatch(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const note = String(formData.get("note") || "").trim();
  const requestedBy =
    session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    const verification = await client.query("select status from portal_fc_verification where id=1");
    if (verification.rows[0]?.status !== "verified") {
      throw new Error("Verify ownership of the configured Free Company before requesting a roster scan.");
    }
    await client.query(
      `
        insert into portal_discord_action_queue (
          discord_user_id,
          action_type,
          action_payload,
          status,
          requested_by,
          requested_at,
          updated_at
        )
        values (
          '__guild_name_match__',
          'match_discord_names',
          $1::jsonb,
          'pending',
          $2,
          now(),
          now()
        )
        on conflict (discord_user_id, action_type)
        where status = 'pending'
        do update set
          action_payload = excluded.action_payload,
          requested_by = excluded.requested_by,
          requested_at = now(),
          updated_at = now();
      `,
      [JSON.stringify({ note }), requestedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function createDiscordScheduledPost(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const clean = (key: string) => String(formData.get(key) || "").trim();

  const postType = clean("postType") || "custom";
  const title = clean("title");
  const message = clean("message");
  const targetChannelKind = clean("targetChannelKind") || "event";
  const scheduledDate = clean("scheduledDate");
  const scheduledTime = clean("scheduledTime");

  if (!title) {
    throw new Error("A title is required.");
  }

  if (!message) {
    throw new Error("A message is required.");
  }

  if (!scheduledDate || !scheduledTime) {
    throw new Error("A post date and post time are required.");
  }

  const scheduledFor = buildScheduledPostDateTime(scheduledDate, scheduledTime);
  const discordBotSettings = await getDiscordBotSettings();
  const channelMap: Record<string, string> = {
    event: discordBotSettings.event_channel_id,
    raid: discordBotSettings.event_channel_id,
    mount_farm: discordBotSettings.event_channel_id,
    officer_log: discordBotSettings.officer_log_channel_id,
    test: discordBotSettings.test_channel_id
  };
  const targetChannelId = channelMap[targetChannelKind] || "";
  if (!targetChannelId) {
    throw new Error(`No Discord channel ID is configured for ${targetChannelKind}. Add it in Discord Bot Settings first.`);
  }


  const createdBy =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        insert into portal_discord_scheduled_posts (
          post_type,
          title,
          message,
          target_channel_kind,
          target_channel_id,
          scheduled_for,
          status,
          created_by,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, 'scheduled', $7, now(), now());
      `,
      [
        postType,
        title,
        message,
        targetChannelKind,
        targetChannelId,
        scheduledFor.toISOString(),
        createdBy
      ]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function cancelDiscordScheduledPost(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const postId = Number(formData.get("postId") || 0);

  if (!postId) {
    throw new Error("A scheduled post ID is required.");
  }

  const cancelledBy =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        update portal_discord_scheduled_posts
        set
          status = 'cancelled',
          cancelled_at = now(),
          cancelled_by = $2,
          updated_at = now()
        where id = $1
          and status = 'scheduled';
      `,
      [postId, cancelledBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function insertReusableEventOccurrence(
  client: Client,
  config: Record<string, any>,
  eventStartsAt: Date,
  createdBy: string,
  seriesId: number | null = null,
  occurrenceNumber: number | null = null
) {
  const leadMinutes = Math.max(0, Number(config.announcement_lead_minutes ?? 10080));
  const requestedAnnouncementAt = leadMinutes === 0
    ? new Date(Date.now() + 60 * 1000)
    : new Date(eventStartsAt.getTime() - leadMinutes * 60 * 1000);
  const announcementPostAt = new Date(Math.max(Date.now() + 60 * 1000, requestedAnnouncementAt.getTime()));
  const eventResult = await client.query(
    `insert into portal_discord_events (
       event_type, title, description, level, duty_id, duty_name, duty_image_url,
       target_channel_kind, target_channel_id, event_starts_at, announcement_post_at,
       party_strategy, party_size, standard_party_roles_required, check_in_required, series_id, series_occurrence_number,
       reminder_24h_enabled, reminder_1h_enabled, status, created_by, created_at, updated_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
       $18, $19, 'planned', $20, now(), now()
     )
     on conflict (series_id, event_starts_at) where series_id is not null do nothing
     returning id::int;`,
    [config.event_type, config.title, config.description || "", config.level,
     config.duty_id, config.duty_name, config.duty_image_url, config.target_channel_kind,
     config.target_channel_id, eventStartsAt.toISOString(), announcementPostAt.toISOString(),
     config.party_strategy || "rotation", Number(config.party_size || 8),
     config.standard_party_roles_required !== false, config.check_in_required === true, seriesId, occurrenceNumber,
     Boolean(config.reminder_24h_enabled), Boolean(config.reminder_1h_enabled), createdBy]
  );
  if (eventResult.rows.length === 0) return null;
  const eventId = Number(eventResult.rows[0].id);
  if (config.mount_id) {
    await client.query(
      `insert into portal_discord_event_mounts (event_id, mount_id, sort_order)
       values ($1, $2, 10) on conflict (event_id, mount_id) do nothing;`,
      [eventId, Number(config.mount_id)]
    );
  }
  const typeLabel = config.event_type === "mount_farm" ? "Mount Farm" : config.event_type === "raid" ? "Raid" : "Event";
  const announcementLines = [
    `**Type:** ${typeLabel}`,
    config.series_name ? `**Series:** ${config.series_name}` : "",
    `**Event Time:** ${formatDiscordEventTime(eventStartsAt)}`,
    `**Party Plan:** ${config.party_strategy === "split" ? "Split Teams" : "Rotation"} - ${Number(config.party_size || 8)} per party - ${config.standard_party_roles_required === false ? "flexible composition" : "standard roles required"}`,
    config.check_in_required === true ? `**Check-in:** Required - opens 1 hour before the event` : "",
    config.level ? `**Level:** ${config.level}` : "",
    config.duty_name ? `**Duty / Raid:** ${config.duty_name}` : "",
    config.mount_name ? `**Mount Target:** ${config.mount_name}` : "",
    config.mount_source_name ? `**Source:** ${config.mount_source_name}` : "",
    config.description ? `**Notes:**\n${config.description}` : ""
  ].filter(Boolean);
  const postResult = await client.query(
    `insert into portal_discord_scheduled_posts (
       post_type, title, message, embed_image_url, thumbnail_image_url,
       target_channel_kind, target_channel_id, scheduled_for, status,
       created_by, event_id, reminder_offset_minutes, created_at, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, null, now(), now())
     returning id::int;`,
    [config.event_type, config.title, announcementLines.join("\n"), config.embed_image_url,
     config.thumbnail_image_url, config.target_channel_kind, config.target_channel_id,
     announcementPostAt.toISOString(), createdBy, eventId]
  );
  await client.query(
    `update portal_discord_events set announcement_scheduled_post_id = $2 where id = $1;`,
    [eventId, Number(postResult.rows[0].id)]
  );
  const reminders = [
    { enabled: Boolean(config.reminder_24h_enabled), offset: 1440, label: "24-hour" },
    { enabled: Boolean(config.reminder_1h_enabled), offset: 60, label: "1-hour" }
  ];
  for (const reminder of reminders) {
    if (!reminder.enabled) continue;
    const scheduledFor = new Date(eventStartsAt.getTime() - reminder.offset * 60 * 1000);
    if (scheduledFor.getTime() <= announcementPostAt.getTime() || scheduledFor.getTime() <= Date.now()) continue;
    await client.query(
      `insert into portal_discord_scheduled_posts (
         post_type, title, message, embed_image_url, thumbnail_image_url,
         target_channel_kind, target_channel_id, scheduled_for, status,
         created_by, event_id, reminder_offset_minutes, created_at, updated_at
       ) values ('event_reminder', $1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10, now(), now());`,
      [`${reminder.label} reminder: ${config.title}`,
       [`**Reminder:** This event starts in ${reminder.label.replace("-", " ")}.`, ...announcementLines].join("\n"),
       config.embed_image_url, config.thumbnail_image_url, config.target_channel_kind,
       config.target_channel_id, scheduledFor.toISOString(), createdBy, eventId, reminder.offset]
    );
  }
  return eventId;
}

async function advanceRecurringSeries(client: Client, seriesId: number, generated: boolean) {
  const result = await client.query(
    `update portal_discord_event_series
     set next_occurrence_at = case recurrence_kind
           when 'weekly' then ((next_occurrence_at at time zone 'America/Chicago') + interval '7 days') at time zone 'America/Chicago'
           when 'biweekly' then ((next_occurrence_at at time zone 'America/Chicago') + interval '14 days') at time zone 'America/Chicago'
           when 'monthly' then ((next_occurrence_at at time zone 'America/Chicago') + interval '1 month') at time zone 'America/Chicago'
           else ((next_occurrence_at at time zone 'America/Chicago') + interval '7 days') at time zone 'America/Chicago'
         end,
         next_occurrence_number = next_occurrence_number + 1,
         generated_count = generated_count + case when $2 then 1 else 0 end,
         last_generated_at = case when $2 then now() else last_generated_at end,
         updated_at = now()
     where id = $1 returning *;`,
    [seriesId, generated]
  );
  return result.rows[0] || null;
}

async function generateRecurringEventOccurrences(client: Client, onlySeriesId: number | null = null) {
  const result = await client.query(
    `select * from portal_discord_event_series
     where active = true and ($1::bigint is null or id = $1)
     order by id asc for update;`,
    [onlySeriesId]
  );
  for (const initialSeries of result.rows) {
    let series = initialSeries;
    const countResult = await client.query(
      `select count(*)::int as count from portal_discord_events
       where series_id = $1 and event_starts_at >= now();`,
      [series.id]
    );
    let futureCount = Number(countResult.rows[0]?.count || 0);
    let safety = 0;
    while (futureCount < Number(series.occurrences_ahead || 4) && safety < 24) {
      safety += 1;
      const startsAt = new Date(series.next_occurrence_at);
      if (series.end_at && startsAt.getTime() > new Date(series.end_at).getTime()) {
        await client.query(
          `update portal_discord_event_series
           set active = false, ended_at = coalesce(ended_at, now()), ended_by = coalesce(ended_by, 'Series end date'), updated_at = now()
           where id = $1;`,
          [series.id]
        );
        break;
      }
      if (startsAt.getTime() < Date.now() - 6 * 60 * 60 * 1000) {
        series = await advanceRecurringSeries(client, Number(series.id), false);
        if (!series) break;
        continue;
      }
      const eventId = await insertReusableEventOccurrence(
        client, series, startsAt, series.created_by || "Recurring event series",
        Number(series.id), Number(series.next_occurrence_number || 1)
      );
      series = await advanceRecurringSeries(client, Number(series.id), Boolean(eventId));
      if (eventId) futureCount += 1;
      if (!series) break;
    }
  }
}

async function saveEventAsTemplate(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const eventId = Number(formData.get("eventId") || 0);
  const templateName = String(formData.get("templateName") || "").trim();
  const announcementLeadMinutes = Number(formData.get("announcementLeadMinutes") || 10080);
  if (!eventId || !templateName) throw new Error("An event and template name are required.");
  if (![0, 1440, 4320, 10080].includes(announcementLeadMinutes)) throw new Error("Choose a valid announcement lead time.");
  const createdBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    const result = await client.query(
      `select e.*, target.mount_id::int, m.mount_name, m.source_name as mount_source_name,
              p.embed_image_url, p.thumbnail_image_url
       from portal_discord_events e
       left join lateral (
         select em.mount_id from portal_discord_event_mounts em
         where em.event_id = e.id order by em.sort_order asc, em.mount_id asc limit 1
       ) target on true
       left join portal_mounts m on m.id = target.mount_id
       left join portal_discord_scheduled_posts p on p.id = e.announcement_scheduled_post_id
       where e.id = $1 limit 1;`,
      [eventId]
    );
    if (result.rows.length === 0) throw new Error("Event not found.");
    const event = result.rows[0];
    await client.query(
      `insert into portal_discord_event_templates (
         name, event_type, title, description, level, duty_id, duty_name, duty_image_url,
         mount_id, mount_name, mount_source_name, embed_image_url, thumbnail_image_url,
         target_channel_kind, target_channel_id, party_strategy, party_size,
         standard_party_roles_required, check_in_required, reminder_24h_enabled, reminder_1h_enabled, announcement_lead_minutes,
         created_by, created_at, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now(),now())
       on conflict (name) do update set
         event_type=excluded.event_type, title=excluded.title, description=excluded.description,
         level=excluded.level, duty_id=excluded.duty_id, duty_name=excluded.duty_name,
         duty_image_url=excluded.duty_image_url, mount_id=excluded.mount_id,
         mount_name=excluded.mount_name, mount_source_name=excluded.mount_source_name,
         embed_image_url=excluded.embed_image_url, thumbnail_image_url=excluded.thumbnail_image_url,
         target_channel_kind=excluded.target_channel_kind, target_channel_id=excluded.target_channel_id,
         party_strategy=excluded.party_strategy, party_size=excluded.party_size,
         check_in_required=excluded.check_in_required,
         standard_party_roles_required=excluded.standard_party_roles_required,
         reminder_24h_enabled=excluded.reminder_24h_enabled,
         reminder_1h_enabled=excluded.reminder_1h_enabled,
         announcement_lead_minutes=excluded.announcement_lead_minutes,
         created_by=excluded.created_by, updated_at=now();`,
      [templateName, event.event_type, event.title, event.description, event.level, event.duty_id,
       event.duty_name, event.duty_image_url, event.mount_id, event.mount_name,
       event.mount_source_name, event.embed_image_url, event.thumbnail_image_url,
       event.target_channel_kind, event.target_channel_id, event.party_strategy,
       event.party_size, event.standard_party_roles_required !== false, event.check_in_required === true,
       event.reminder_24h_enabled, event.reminder_1h_enabled, announcementLeadMinutes, createdBy]
    );
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function createEventFromTemplate(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const templateId = Number(formData.get("templateId") || 0);
  const eventDate = String(formData.get("eventDate") || "").trim();
  const eventTime = String(formData.get("eventTime") || "").trim();
  if (!templateId || !eventDate || !eventTime) throw new Error("Choose a template, date, and time.");
  const startsAt = buildScheduledPostDateTime(eventDate, eventTime);
  if (startsAt.getTime() <= Date.now()) throw new Error("The copied event must start in the future.");
  const createdBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    const result = await client.query(`select * from portal_discord_event_templates where id = $1 limit 1;`, [templateId]);
    if (result.rows.length === 0) throw new Error("Template not found.");
    await insertReusableEventOccurrence(client, result.rows[0], startsAt, createdBy);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function createEventSeriesFromTemplate(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const templateId = Number(formData.get("templateId") || 0);
  const seriesName = String(formData.get("seriesName") || "").trim();
  const recurrenceKind = String(formData.get("recurrenceKind") || "weekly").trim();
  const startDate = String(formData.get("startDate") || "").trim();
  const startTime = String(formData.get("startTime") || "").trim();
  const endDate = String(formData.get("endDate") || "").trim();
  const occurrencesAhead = Number(formData.get("occurrencesAhead") || 4);
  if (!templateId || !seriesName || !startDate || !startTime) throw new Error("Template, series name, start date, and time are required.");
  if (!["weekly", "biweekly", "monthly"].includes(recurrenceKind)) throw new Error("Choose a valid recurrence.");
  if (!Number.isFinite(occurrencesAhead) || occurrencesAhead < 1 || occurrencesAhead > 8) throw new Error("Keep between 1 and 8 upcoming occurrences.");
  const startsAt = buildScheduledPostDateTime(startDate, startTime);
  if (startsAt.getTime() <= Date.now()) throw new Error("The recurring series must start in the future.");
  const endAt = endDate ? buildScheduledPostDateTime(endDate, "23:59") : null;
  if (endAt && endAt.getTime() < startsAt.getTime()) throw new Error("The series end date must be after its first event.");
  const createdBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    const templateResult = await client.query(`select * from portal_discord_event_templates where id = $1 limit 1;`, [templateId]);
    if (templateResult.rows.length === 0) throw new Error("Template not found.");
    const template = templateResult.rows[0];
    const seriesResult = await client.query(
      `insert into portal_discord_event_series (
         template_id, series_name, event_type, title, description, level, duty_id, duty_name,
         duty_image_url, mount_id, mount_name, mount_source_name, embed_image_url,
         thumbnail_image_url, target_channel_kind, target_channel_id, party_strategy,
         party_size, standard_party_roles_required, check_in_required, reminder_24h_enabled, reminder_1h_enabled,
         announcement_lead_minutes, recurrence_kind, next_occurrence_at, end_at, occurrences_ahead, active,
         created_by, created_at, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,true,$28,now(),now())
       returning id::int;`,
      [templateId, seriesName, template.event_type, template.title, template.description,
       template.level, template.duty_id, template.duty_name, template.duty_image_url,
       template.mount_id, template.mount_name, template.mount_source_name,
       template.embed_image_url, template.thumbnail_image_url, template.target_channel_kind,
       template.target_channel_id, template.party_strategy, template.party_size,
       template.standard_party_roles_required !== false, template.check_in_required === true, template.reminder_24h_enabled,
       template.reminder_1h_enabled, template.announcement_lead_minutes, recurrenceKind,
       startsAt.toISOString(), endAt?.toISOString() || null,
       Math.floor(occurrencesAhead), createdBy]
    );
    await generateRecurringEventOccurrences(client, Number(seriesResult.rows[0].id));
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function manageEventSeries(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const seriesId = Number(formData.get("seriesId") || 0);
  const seriesAction = String(formData.get("seriesAction") || "").trim();
  if (!seriesId || !["pause", "resume", "end"].includes(seriesAction)) throw new Error("Choose a valid recurring-series action.");
  const changedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    if (seriesAction === "pause") {
      await client.query(`update portal_discord_event_series set active=false, paused_at=now(), paused_by=$2, updated_at=now() where id=$1 and ended_at is null;`, [seriesId, changedBy]);
    } else if (seriesAction === "resume") {
      await client.query(`update portal_discord_event_series set active=true, paused_at=null, paused_by=null, updated_at=now() where id=$1 and ended_at is null;`, [seriesId]);
      await generateRecurringEventOccurrences(client, seriesId);
    } else {
      await client.query(`update portal_discord_event_series set active=false, ended_at=now(), ended_by=$2, updated_at=now() where id=$1;`, [seriesId, changedBy]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function deleteEventTemplate(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const templateId = Number(formData.get("templateId") || 0);
  if (!templateId) throw new Error("A valid template is required.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query(`delete from portal_discord_event_templates where id = $1;`, [templateId]);
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
async function createDiscordEvent(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);
  const organizerCharacter = await getEligibleMemberCharacter(session);
  if (!isOfficer && !organizerCharacter) {
    throw new Error("Member access requires a Discord-linked active character with current Free Company membership.");
  }

  const clean = (key: string) => String(formData.get(key) || "").trim();

  let eventType = clean("eventType") || "custom";
  const title = clean("title");
  const description = clean("description");
  const requestedChannelKind = clean("targetChannelKind") || "event";
  const isMemberCreatedEvent = String(formData.get("memberCreatedEvent") || "") === "true";
  let targetChannelKind = isOfficer ? requestedChannelKind : "event";
  const eventDate = clean("eventDate");
  const eventTime = clean("eventTime");
  const announcementDate = clean("announcementDate");
  const announcementTime = clean("announcementTime");
  const dutyImageOverrideUrl = clean("dutyImageUrl");
  const levelValue = clean("level");
  const levelMinValue = clean("levelMin");
  const levelMaxValue = clean("levelMax");
  const customCategory = clean("customCategory") || "unclassified";
  const eventTimeZone = clean("eventTimeZone") || portalTimeZone;
  const partyStrategy = clean("partyStrategy") || "rotation";
  const partySizeValue = clean("partySize");
  const standardPartyRolesRequired = formData.get("standardPartyRolesRequired") === "on";
  const checkInRequired = isOfficer && formData.get("checkInRequired") === "on";
  const dutyId = Number(formData.get("dutyId") || 0);
  const mountId = Number(formData.get("mountId") || 0);
  const eventPlanId = Number(formData.get("eventPlanId") || 0);
  const reminder24Hours = formData.get("reminder24Hours") === "on";
  const reminder1Hour = formData.get("reminder1Hour") === "on";

  if (!title) {
    throw new Error("An event title is required.");
  }

  if (!["rotation", "split"].includes(partyStrategy)) {
    throw new Error("Choose Rotation or Split Teams for the party strategy.");
  }

  if (!eventDate || !eventTime) {
    throw new Error("An event date and time are required.");
  }
  if (!isSupportedMemberEventTimeZone(eventTimeZone)) {
    throw new Error("Choose a valid event timezone under member settings.");
  }

  if ((announcementDate && !announcementTime) || (!announcementDate && announcementTime)) {
    throw new Error("Announcement date and time must be filled together.");
  }

  if (dutyImageOverrideUrl && !/^https?:\/\//i.test(dutyImageOverrideUrl)) {
    throw new Error("Duty image override URL must start with http:// or https://.");
  }

  const eventStartsAt = buildScheduledPostDateTime(eventDate, eventTime, eventTimeZone);

  const announcementPostAt =
    announcementDate && announcementTime
      ? buildScheduledPostDateTime(announcementDate, announcementTime)
      : new Date(Date.now() + 60 * 1000);

  const createdBy = organizerCharacter?.character_name || session?.user?.name || session?.user?.email || "Unknown organizer";

  let eventTypeLabel =
    eventType === "mount_farm"
      ? "Mount Farm"
      : eventType === "raid"
        ? "Raid"
        : "Event";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query("begin");

    let selectedDuty: {
      id: number;
      duty_type: string;
      name: string;
      expansion: string | null;
      level: number | null;
      party_size: number | null;
      image_url: string | null;
      notes: string | null;
    } | null = null;

    if (Number.isFinite(dutyId) && dutyId > 0) {
      const dutyResult = await client.query(
        `
          select
            id::int,
            duty_type,
            name,
            expansion,
            level,
            party_size,
            image_url,
            notes
          from portal_discord_duties
          where id = $1
            and active = true
          limit 1;
        `,
        [dutyId]
      );

      selectedDuty = dutyResult.rows[0] || null;
    }

    let selectedMount: {
      mount_name: string;
      source_name: string | null;
      icon_url: string | null;
      image_url: string | null;
      set_name: string | null;
      expansion: string | null;
    } | null = null;

    if (Number.isFinite(mountId) && mountId > 0) {
      const mountResult = await client.query(
        `
          select
            m.mount_name,
            m.source_name,
            m.icon_url,
            m.image_url,
            ms.name as set_name,
            ms.expansion
          from portal_mounts m
          left join portal_mount_sets ms
            on ms.id = m.mount_set_id
          where m.id = $1
          limit 1;
        `,
        [mountId]
      );

      selectedMount = mountResult.rows[0] || null;
    }

if (!selectedDuty && selectedMount?.source_name) {
  const guessedDutyName = getDutyNameFromMountSource(selectedMount.source_name);

  if (guessedDutyName) {
    const autoDutyResult = await client.query(
      `
        select
          id::int,
          duty_type,
          name,
          expansion,
          level,
          party_size,
          image_url,
          notes
        from portal_discord_duties
        where active = true
          and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g')
            = regexp_replace(lower($1::text), '[^a-z0-9]+', '', 'g')
        order by sort_order asc, lower(name) asc
        limit 1;
      `,
      [guessedDutyName]
    );

    selectedDuty = autoDutyResult.rows[0] || null;
  }
}

    if (isMemberCreatedEvent) {
      const selectedDutyType = String(selectedDuty?.duty_type || "").trim().toLowerCase();
      const isCustomEvent = !selectedDuty;
      if (isCustomEvent) {
        if (!["raid", "trial", "treasure_maps", "dungeon", "unclassified"].includes(customCategory)) {
          throw new Error("Choose a valid custom event category.");
        }
        eventType = customCategory === "unclassified" ? "custom" : customCategory;
        eventTypeLabel = customCategory === "treasure_maps"
          ? "Treasure Maps"
          : customCategory === "unclassified"
            ? "Unclassified"
            : `${customCategory[0].toUpperCase()}${customCategory.slice(1)}`;
      }
      const defaultChannelKind = "event";
      const allowedOfficerChannels = ["event", "test"];
      targetChannelKind = isOfficer && allowedOfficerChannels.includes(requestedChannelKind)
        ? requestedChannelKind
        : defaultChannelKind;
    }

    const discordBotSettings = await getDiscordBotSettings();
    const channelMap: Record<string, string> = {
      event: discordBotSettings.event_channel_id,
      raid: discordBotSettings.event_channel_id,
      mount_farm: discordBotSettings.event_channel_id,
      officer_log: discordBotSettings.officer_log_channel_id,
      test: discordBotSettings.test_channel_id
    };
    const targetChannelId = channelMap[targetChannelKind] || "";
    if (!targetChannelId) {
      throw new Error(`No Discord channel ID is configured for ${targetChannelKind}. Add it in Discord Bot Settings first.`);
    }

    const requestedLevel = levelMinValue ? Number(levelMinValue) : levelValue ? Number(levelValue) : null;
    const requestedLevelMax = levelMaxValue ? Number(levelMaxValue) : null;
    const dutyMinimumLevel = selectedDuty?.level ?? null;
    const resolvedLevel = requestedLevel === null
      ? dutyMinimumLevel
      : dutyMinimumLevel === null
        ? requestedLevel
        : Math.max(requestedLevel, dutyMinimumLevel);

    if (
      resolvedLevel !== null &&
      (!Number.isFinite(resolvedLevel) || resolvedLevel < 1 || resolvedLevel > 200)
    ) {
      throw new Error("Event level must be between 1 and 200.");
    }
    if (requestedLevelMax !== null && (!Number.isFinite(requestedLevelMax) || requestedLevelMax < 1 || requestedLevelMax > 200)) {
      throw new Error("Maximum event level must be between 1 and 200.");
    }
    if (isMemberCreatedEvent && !selectedDuty && (resolvedLevel === null || requestedLevelMax === null)) {
      throw new Error("Choose both a minimum and maximum level for a custom event.");
    }
    if (resolvedLevel !== null && requestedLevelMax !== null && requestedLevelMax < resolvedLevel) {
      throw new Error("Maximum level must be greater than or equal to minimum level.");
    }

    const requestedPartySize = partySizeValue ? Number(partySizeValue) : null;
    const resolvedPartySize = requestedPartySize ?? selectedDuty?.party_size ?? 8;
    if (!Number.isFinite(resolvedPartySize) || resolvedPartySize < 1 || resolvedPartySize > 24) {
      throw new Error("Party size must be between 1 and 24.");
    }
    const dutyNameForEvent = selectedDuty?.name || null;
    const dutyImageForEvent = dutyImageOverrideUrl || selectedDuty?.image_url || null;
    const mountImageUrl = selectedMount?.image_url || selectedMount?.icon_url || null;

    const primaryImageUrl =
      eventType === "mount_farm"
        ? mountImageUrl || dutyImageForEvent
        : eventType === "raid"
          ? dutyImageForEvent || mountImageUrl
          : dutyImageForEvent || mountImageUrl;

    const thumbnailImageUrl =
      eventType === "mount_farm"
        ? mountImageUrl && dutyImageForEvent
          ? dutyImageForEvent
          : null
        : eventType === "raid"
          ? dutyImageForEvent && mountImageUrl
            ? mountImageUrl
            : null
          : dutyImageForEvent && mountImageUrl
            ? mountImageUrl
            : null;

    const eventResult = await client.query(
      `
        insert into portal_discord_events (
          event_type,
          title,
          description,
          level,
          duty_id,
          duty_name,
          duty_image_url,
          target_channel_kind,
          target_channel_id,
          event_starts_at,
          announcement_post_at,
          party_strategy,
          party_size,
          standard_party_roles_required,
          check_in_required,
          reminder_24h_enabled,
          reminder_1h_enabled,
          status,
          created_by,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          'planned',
          $18,
          now(),
          now()
        )
        returning id::int;
      `,
      [
        eventType,
        title,
        description,
        resolvedLevel,
        selectedDuty ? selectedDuty.id : null,
        dutyNameForEvent,
        dutyImageForEvent,
        targetChannelKind,
        targetChannelId,
        eventStartsAt.toISOString(),
        announcementPostAt.toISOString(),
        partyStrategy,
        resolvedPartySize,
        standardPartyRolesRequired,
        checkInRequired,
        reminder24Hours,
        reminder1Hour,
        createdBy
      ]
    );

    const eventId = Number(eventResult.rows[0].id);

    if (Number.isFinite(eventPlanId) && eventPlanId > 0) {
      const planUpdate = await client.query(`update portal_event_plans set status='scheduled',finalized_event_id=$2,sync_requested_at=now(),updated_at=now() where id=$1 and status='collecting' and (created_by_discord_user_id=$3 or $4::boolean=true) returning id`,[eventPlanId,eventId,String(session?.user?.discordUserId||""),isOfficer]);
      if(planUpdate.rowCount===0)throw new Error("This planning request is no longer available to schedule.");
    }

    if (requestedLevelMax !== null) {
      await client.query("update portal_discord_events set level_max = $2 where id = $1;", [eventId, requestedLevelMax]);
    }
    await client.query("update portal_discord_events set event_time_zone = $2 where id = $1;", [eventId, eventTimeZone]);

    if (selectedMount && Number.isFinite(mountId) && mountId > 0) {
      await client.query(
        `
          insert into portal_discord_event_mounts (
            event_id,
            mount_id,
            sort_order
          )
          values ($1, $2, 10)
          on conflict (event_id, mount_id) do nothing;
        `,
        [eventId, mountId]
      );
    }

    const announcementLines = [
      `**Type:** ${eventTypeLabel}`,
      `**Event Time:** ${formatDiscordEventTime(eventStartsAt)}`,
      checkInRequired ? `**Check-in:** Required - opens 1 hour before the event` : "",
      `**Party Plan:** ${partyStrategy === "split" ? "Split Teams" : "Rotation"} - ${resolvedPartySize} per party - ${standardPartyRolesRequired ? "standard roles required" : "flexible composition"}`,
      resolvedLevel && requestedLevelMax ? `**Level Range:** ${resolvedLevel}–${requestedLevelMax}` : resolvedLevel ? `**Level:** ${resolvedLevel}` : "",
      dutyNameForEvent ? `**Duty / Raid:** ${dutyNameForEvent}` : "",
      selectedMount ? `**Mount Target:** ${selectedMount.mount_name}` : "",
      selectedMount?.source_name ? `**Source:** ${selectedMount.source_name}` : "",
      description ? "" : "",
      description ? `**Notes:**\n${description}` : ""
    ].filter(Boolean);

    const scheduledPostResult = await client.query(
      `
        insert into portal_discord_scheduled_posts (
          post_type,
          title,
          message,
          embed_image_url,
          thumbnail_image_url,
          target_channel_kind,
          target_channel_id,
          scheduled_for,
          status,
          created_by,
          event_id,
          reminder_offset_minutes,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, null, now(), now())
        returning id::int;
      `,
      [
        eventType,
        title,
        announcementLines.join("\n"),
        primaryImageUrl,
        thumbnailImageUrl,
        targetChannelKind,
        targetChannelId,
        announcementPostAt.toISOString(),
        createdBy,
        eventId
      ]
    );

    const scheduledPostId = Number(scheduledPostResult.rows[0].id);

    await client.query(
      `
        update portal_discord_events
        set
          announcement_scheduled_post_id = $2,
          updated_at = now()
        where id = $1;
      `,
      [eventId, scheduledPostId]
    );

    const reminderRequests = [
      { enabled: reminder24Hours, offsetMinutes: 24 * 60, label: "24-hour" },
      { enabled: reminder1Hour, offsetMinutes: 60, label: "1-hour" }
    ];

    for (const reminder of reminderRequests) {
      if (!reminder.enabled) continue;
      const scheduledFor = new Date(eventStartsAt.getTime() - reminder.offsetMinutes * 60 * 1000);
      if (scheduledFor.getTime() <= Date.now() || scheduledFor.getTime() <= announcementPostAt.getTime()) continue;

      const reminderMessage = [
        `**Reminder:** This event starts in ${reminder.label.replace("-", " ")}.`,
        ...announcementLines
      ].join("\n");

      await client.query(
        `insert into portal_discord_scheduled_posts (
           post_type, title, message, embed_image_url, thumbnail_image_url,
           target_channel_kind, target_channel_id, scheduled_for, status,
           created_by, event_id, reminder_offset_minutes, created_at, updated_at
         ) values (
           'event_reminder', $1, $2, $3, $4, $5, $6, $7,
           'scheduled', $8, $9, $10, now(), now()
         );`,
        [
          `${reminder.label} reminder: ${title}`,
          reminderMessage,
          primaryImageUrl,
          thumbnailImageUrl,
          targetChannelKind,
          targetChannelId,
          scheduledFor.toISOString(),
          createdBy,
          eventId,
          reminder.offsetMinutes
        ]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function saveEventSignup(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  const memberCharacter = await requireEligibleMemberCharacter(session);
  const discordUserId = String(session?.user?.discordUserId || "").trim();
  const requestedBy = String(session?.user?.email || session?.user?.name || "Discord member").trim();
  const eventId = Number(formData.get("eventId") || 0);
  const signupStatus = String(formData.get("signupStatus") || "").trim();
  const rolePreference = String(formData.get("rolePreference") || "").trim();
  const secondaryRolePreference = String(formData.get("secondaryRolePreference") || "none").trim();
  const notes = String(formData.get("notes") || "").trim();
  const allowedStatuses = new Set(["going", "maybe", "cant_attend"]);
  const allowedRoles = new Set(["tank", "healer", "melee_dps", "ranged_dps", "caster", "flexible"]);
  if (!Number.isFinite(eventId) || eventId <= 0) throw new Error("A valid event is required.");
  if (!allowedStatuses.has(signupStatus)) throw new Error("Choose Going, Maybe, or Can't Attend.");
  if (!allowedRoles.has(rolePreference)) throw new Error("Choose a valid FFXIV role preference.");
  if (!(secondaryRolePreference === "none" || allowedRoles.has(secondaryRolePreference))) throw new Error("Choose a valid secondary role preference.");
  if (notes.length > 500) throw new Error("RSVP notes must be 500 characters or fewer.");
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`,[`event-member:${eventId}:${discordUserId}`]);
    const characterId = memberCharacter.id;
    const eventResult = await client.query(
      `select id, roster_locked from portal_discord_events where id = $1 and status = 'planned' limit 1;`, [eventId]
    );
    if (eventResult.rows.length === 0) throw new Error("This event is no longer available for signups.");
    if (eventResult.rows[0].roster_locked) throw new Error("This event roster is locked. Ask an officer to make changes.");
    await client.query(`update portal_discord_event_signups s set character_id=$2,updated_at=now()
      where s.event_id=$1 and s.character_id<>$2
        and (exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=s.character_id)
          or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=s.character_id and acl.active=true))
        and not exists(select 1 from portal_discord_event_signups target where target.event_id=$1 and target.character_id=$2)
        and s.character_id=(select owned.character_id from portal_discord_event_signups owned
          where owned.event_id=$1 and (exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=owned.character_id)
            or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=owned.character_id and acl.active=true))
          order by owned.created_at,owned.character_id limit 1)`,[eventId,characterId,discordUserId]);
    await client.query(`delete from portal_discord_event_signups s where s.event_id=$1 and s.character_id<>$2 and (exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=s.character_id) or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=s.character_id and acl.active=true))`,[eventId,characterId,discordUserId]);
    await client.query(
      `insert into portal_discord_event_signups (
         event_id, character_id, signup_status, role_preference, secondary_role_preference, notes, roster_state,
         party_number, completed_at, completed_by, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, nullif($6, ''), case when $3 = 'going' then 'active' else 'waiting' end,
                 null, null, null, now(), now())
       on conflict (event_id, character_id) do update set
         signup_status = excluded.signup_status,
         role_preference = excluded.role_preference,
         secondary_role_preference = excluded.secondary_role_preference,
         notes = excluded.notes,
         roster_state = case
           when excluded.signup_status = 'going' and portal_discord_event_signups.roster_state = 'completed'
             and portal_discord_event_signups.signup_status = 'going' then 'completed'
           when excluded.signup_status = 'going' then 'active'
           else 'waiting'
         end,
         party_number = case when excluded.signup_status = 'going' then portal_discord_event_signups.party_number else null end,
         completed_at = case
           when excluded.signup_status = 'going' and portal_discord_event_signups.roster_state = 'completed'
             then portal_discord_event_signups.completed_at
           else null
         end,
         completed_by = case
           when excluded.signup_status = 'going' and portal_discord_event_signups.roster_state = 'completed'
             then portal_discord_event_signups.completed_by
           else null
         end,
         attendance_status = case
           when excluded.signup_status = 'going' then portal_discord_event_signups.attendance_status
           else 'not_checked_in'
         end,
         checked_in_at = case
           when excluded.signup_status = 'going' then portal_discord_event_signups.checked_in_at
           else null
         end,
         attendance_updated_at = case when excluded.signup_status = 'going' then portal_discord_event_signups.attendance_updated_at else now() end,
         attendance_updated_by = case when excluded.signup_status = 'going' then portal_discord_event_signups.attendance_updated_by else $7 end,
         updated_at = now();`,
      [eventId, characterId, signupStatus, rolePreference, secondaryRolePreference, notes, requestedBy]
    );
    await rebalanceEventRoster(client, eventId);
    await queueDiscordEventRefresh(client, eventId, requestedBy);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function checkInToEvent(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  const memberCharacter = await requireEligibleMemberCharacter(session);
  const discordUserId = String(session?.user?.discordUserId || "").trim();
  const requestedBy = String(session?.user?.email || session?.user?.name || "Discord member").trim();
  const eventId = Number(formData.get("eventId") || 0);
  if (!Number.isFinite(eventId) || eventId <= 0) throw new Error("A valid event is required.");

  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    const characterId = memberCharacter.id;
    const eventResult = await client.query(
      `select event_starts_at, event_ends_at, status, check_in_required
       from portal_discord_events where id = $1 limit 1 for update;`,
      [eventId]
    );
    if (eventResult.rows.length === 0) throw new Error("This event could not be found.");
    if (!isEventCheckInOpen(eventResult.rows[0])) {
      throw new Error("Check-in opens one hour before the event and closes when the event ends.");
    }
    const signupResult = await client.query(
      `update portal_discord_event_signups
       set signup_status = 'going', attendance_status = 'present',
           checked_in_at = coalesce(checked_in_at, now()), attendance_updated_at = now(),
           attendance_updated_by = $4, updated_at = now()
       where event_id = $1 and signup_status in ('going', 'maybe')
         and (character_id = $2 or exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=portal_discord_event_signups.character_id) or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=portal_discord_event_signups.character_id and acl.active=true))
       returning character_id;`,
      [eventId, characterId, discordUserId, requestedBy]
    );
    if (signupResult.rows.length === 0) throw new Error("RSVP Going or Maybe before checking in.");
    await rebalanceEventRoster(client, eventId);
    await queueDiscordEventRefresh(client, eventId, requestedBy);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function editDiscordEvent(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");

  const clean = (key: string) => String(formData.get(key) || "").trim();
  const eventId = Number(formData.get("eventId") || 0);
  const eventType = clean("eventType") || "custom";
  const title = clean("title");
  const description = clean("description");
  const eventDate = clean("eventDate");
  const eventTime = clean("eventTime");
  const eventTimeZone = clean("eventTimeZone") || portalTimeZone;
  const levelValue = clean("level");
  const levelMaxValue = clean("levelMax");
  const dutyImageOverrideUrl = clean("dutyImageUrl");
  const dutyId = Number(formData.get("dutyId") || 0);
  const mountId = Number(formData.get("mountId") || 0);
  const partyStrategy = clean("partyStrategy") || "rotation";
  const partySize = Number(formData.get("partySize") || 8);
  const standardPartyRolesRequired = formData.get("standardPartyRolesRequired") === "on";
  const checkInRequired = formData.get("checkInRequired") === "on";
  const rosterLocked = formData.get("rosterLocked") === "on";
  const reminder24Hours = formData.get("reminder24Hours") === "on";
  const reminder1Hour = formData.get("reminder1Hour") === "on";
  const confirmRestrictedEdit = formData.get("confirmRestrictedEdit") === "on";

  if (!Number.isFinite(eventId) || eventId <= 0) throw new Error("A valid event is required.");
  if (!["mount_farm", "raid", "trial", "treasure_maps", "dungeon", "custom"].includes(eventType)) throw new Error("Choose a valid event type.");
  if (!title) throw new Error("An event title is required.");
  if (!eventDate || !eventTime) throw new Error("An event date and time are required.");
  if (!isSupportedMemberEventTimeZone(eventTimeZone)) throw new Error("Choose a valid event timezone.");
  if (!["rotation", "split"].includes(partyStrategy)) throw new Error("Choose Rotation or Split Teams.");
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 24) throw new Error("Party size must be between 1 and 24.");
  if (dutyImageOverrideUrl && !/^https?:\/\//i.test(dutyImageOverrideUrl)) {
    throw new Error("Duty image override URL must start with http:// or https://.");
  }

  const eventStartsAt = buildScheduledPostDateTime(eventDate, eventTime, eventTimeZone);
  const changedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    const currentResult = await client.query(
      `select e.*, p.status as announcement_status
       from portal_discord_events e
       left join portal_discord_scheduled_posts p on p.id = e.announcement_scheduled_post_id
       where e.id = $1 and e.status = 'planned'
       limit 1 for update of e;`,
      [eventId]
    );
    if (currentResult.rows.length === 0) throw new Error("Only a planned event can be edited.");
    const current = currentResult.rows[0];
    const currentMountResult = await client.query(
      `select em.mount_id::int
       from portal_discord_event_mounts em
       where em.event_id = $1
       order by em.sort_order asc, em.mount_id asc
       limit 1;`,
      [eventId]
    );
    const currentMountId = currentMountResult.rows[0]?.mount_id === undefined
      ? null
      : Number(currentMountResult.rows[0].mount_id);
    const isRestrictedEdit = Boolean(current.roster_locked) || new Date(current.event_starts_at).getTime() <= Date.now() || eventStartsAt.getTime() <= Date.now();
    if (isRestrictedEdit && !confirmRestrictedEdit) {
      throw new Error("Confirm the warning before editing a started, locked, or past-dated event.");
    }

    let selectedDuty: {
      id: number;
      name: string;
      level: number | null;
      party_size: number | null;
      image_url: string | null;
    } | null = null;
    if (Number.isFinite(dutyId) && dutyId > 0) {
      const dutyResult = await client.query(
        `select id::int, name, level, party_size, image_url
         from portal_discord_duties where id = $1 and active = true limit 1;`,
        [dutyId]
      );
      selectedDuty = dutyResult.rows[0] || null;
      if (!selectedDuty) throw new Error("The selected duty is no longer available.");
    }

    let selectedMount: {
      id: number;
      mount_name: string;
      source_name: string | null;
      icon_url: string | null;
      image_url: string | null;
    } | null = null;
    if (Number.isFinite(mountId) && mountId > 0) {
      const mountResult = await client.query(
        `select id::int, mount_name, source_name, icon_url, image_url
         from portal_mounts where id = $1 and active = true limit 1;`,
        [mountId]
      );
      selectedMount = mountResult.rows[0] || null;
      if (!selectedMount) throw new Error("The selected mount is no longer available.");
    }

    if (!selectedDuty && selectedMount?.source_name) {
      const guessedDutyName = getDutyNameFromMountSource(selectedMount.source_name);
      if (guessedDutyName) {
        const autoDutyResult = await client.query(
          `select id::int, name, level, party_size, image_url
           from portal_discord_duties
           where active = true
             and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g')
               = regexp_replace(lower($1::text), '[^a-z0-9]+', '', 'g')
           order by sort_order asc, lower(name) asc limit 1;`,
          [guessedDutyName]
        );
        selectedDuty = autoDutyResult.rows[0] || null;
      }
    }


    const requestedLevel = levelValue ? Number(levelValue) : null;
    const requestedLevelMax = levelMaxValue ? Number(levelMaxValue) : null;
    const dutyMinimumLevel = selectedDuty?.level ?? null;
    const resolvedLevel = requestedLevel === null
      ? dutyMinimumLevel
      : dutyMinimumLevel === null
        ? requestedLevel
        : Math.max(requestedLevel, dutyMinimumLevel);
    if (resolvedLevel !== null && (!Number.isFinite(resolvedLevel) || resolvedLevel < 1 || resolvedLevel > 200)) {
      throw new Error("Event level must be between 1 and 200.");
    }
    if (requestedLevelMax !== null && (!Number.isFinite(requestedLevelMax) || requestedLevelMax < 1 || requestedLevelMax > 200)) {
      throw new Error("Maximum event level must be between 1 and 200.");
    }
    if (resolvedLevel !== null && requestedLevelMax !== null && requestedLevelMax < resolvedLevel) {
      throw new Error("Maximum level must be greater than or equal to minimum level.");
    }

    const dutyName = selectedDuty?.name || null;
    const dutyImageUrl = dutyImageOverrideUrl || selectedDuty?.image_url || null;
    const mountImageUrl = selectedMount?.image_url || selectedMount?.icon_url || null;
    const primaryImageUrl = eventType === "mount_farm"
      ? mountImageUrl || dutyImageUrl
      : dutyImageUrl || mountImageUrl;
    const thumbnailImageUrl = primaryImageUrl && dutyImageUrl && mountImageUrl
      ? primaryImageUrl === mountImageUrl ? dutyImageUrl : mountImageUrl
      : null;
    const eventTypeLabel = eventType === "mount_farm" ? "Mount Farm" : eventType === "treasure_maps" ? "Treasure Maps" : eventType === "custom" ? "Unclassified" : `${eventType[0].toUpperCase()}${eventType.slice(1)}`;
    const announcementLines = [
      `**Type:** ${eventTypeLabel}`,
      `**Event Time:** ${formatDiscordEventTime(eventStartsAt)}`,
      checkInRequired ? `**Check-in:** Required - opens 1 hour before the event` : "",
      `**Party Plan:** ${partyStrategy === "split" ? "Split Teams" : "Rotation"} - ${Math.floor(partySize)} per party - ${standardPartyRolesRequired ? "standard roles required" : "flexible composition"}`,
      resolvedLevel && requestedLevelMax ? `**Level Range:** ${resolvedLevel}–${requestedLevelMax}` : resolvedLevel ? `**Level:** ${resolvedLevel}` : "",
      dutyName ? `**Duty / Raid:** ${dutyName}` : "",
      selectedMount ? `**Mount Target:** ${selectedMount.mount_name}` : "",
      selectedMount?.source_name ? `**Source:** ${selectedMount.source_name}` : "",
      description ? `**Notes:**\n${description}` : ""
    ].filter(Boolean);
    const oldStart = new Date(current.event_starts_at).getTime();
    const oldEnd = current.event_ends_at ? new Date(current.event_ends_at).getTime() : null;
    const adjustedEnd = oldEnd === null ? null : new Date(eventStartsAt.getTime() + Math.max(0, oldEnd - oldStart));
    const previousValues = {
      eventType: current.event_type,
      title: current.title,
      description: current.description,
      level: current.level,
      levelMax: current.level_max,
      eventTimeZone: current.event_time_zone,
      dutyId: current.duty_id === null ? null : Number(current.duty_id),
      mountId: currentMountId,
      eventStartsAt: current.event_starts_at,
      partyStrategy: current.party_strategy,
      partySize: Number(current.party_size || 8),
      standardPartyRolesRequired: current.standard_party_roles_required !== false,
      checkInRequired: current.check_in_required === true,
      rosterLocked: Boolean(current.roster_locked),
      reminder24Hours: Boolean(current.reminder_24h_enabled),
      reminder1Hour: Boolean(current.reminder_1h_enabled)
    };

    await client.query(
      `update portal_discord_events
       set event_type = $2, title = $3, description = $4, level = $5,
           duty_id = $6, duty_name = $7, duty_image_url = $8,
           event_starts_at = $9, event_ends_at = $10,
           party_strategy = $11, party_size = $12, standard_party_roles_required = $13,
           check_in_required = $14, roster_locked = $15, reminder_24h_enabled = $16, reminder_1h_enabled = $17,
           level_max = $19,
           event_time_zone = $20,
           check_in_opened_at = case when $14 = false or event_starts_at is distinct from $9 then null else check_in_opened_at end,
           attendance_started_at = case when $14 = false or event_starts_at is distinct from $9 then null else attendance_started_at end,
           last_edited_at = now(), last_edited_by = $18, updated_at = now()
       where id = $1;`,
      [eventId, eventType, title, description, resolvedLevel, selectedDuty?.id || null,
       dutyName, dutyImageUrl, eventStartsAt.toISOString(), adjustedEnd?.toISOString() || null,
       partyStrategy, Math.floor(partySize), standardPartyRolesRequired, checkInRequired, rosterLocked,
       reminder24Hours, reminder1Hour, changedBy, requestedLevelMax, eventTimeZone]
    );
    await client.query(`delete from portal_discord_event_mounts where event_id = $1;`, [eventId]);
    if (selectedMount) {
      await client.query(
        `insert into portal_discord_event_mounts (event_id, mount_id, sort_order)
         values ($1, $2, 10);`,
        [eventId, selectedMount.id]
      );
    }
    await client.query(
      `update portal_discord_scheduled_posts
       set post_type = $1, title = $2, message = $3,
           embed_image_url = $4, thumbnail_image_url = $5, updated_at = now()
       where id = $6;`,
      [eventType, title, announcementLines.join("\n"), primaryImageUrl, thumbnailImageUrl,
       current.announcement_scheduled_post_id]
    );
    await client.query(
      `update portal_discord_scheduled_posts
       set status = 'cancelled', cancelled_at = now(), cancelled_by = $2, updated_at = now()
       where event_id = $1 and post_type = 'event_reminder' and status = 'scheduled';`,
      [eventId, `Rescheduled by ${changedBy}`]
    );

    const reminderRequests = [
      { enabled: reminder24Hours, offsetMinutes: 1440, label: "24-hour" },
      { enabled: reminder1Hour, offsetMinutes: 60, label: "1-hour" }
    ];
    const announcementAlreadySent = current.announcement_status === "sent";
    for (const reminder of reminderRequests) {
      if (!reminder.enabled) continue;
      const scheduledFor = new Date(eventStartsAt.getTime() - reminder.offsetMinutes * 60 * 1000);
      if (scheduledFor.getTime() <= Date.now()) continue;
      if (!announcementAlreadySent && scheduledFor.getTime() <= new Date(current.announcement_post_at).getTime()) continue;
      await client.query(
        `insert into portal_discord_scheduled_posts (
           post_type, title, message, embed_image_url, thumbnail_image_url,
           target_channel_kind, target_channel_id, scheduled_for, status,
           created_by, event_id, reminder_offset_minutes, created_at, updated_at
         ) values (
           'event_reminder', $1, $2, $3, $4, $5, $6, $7,
           'scheduled', $8, $9, $10, now(), now()
         );`,
        [`${reminder.label} reminder: ${title}`,
         [`**Reminder:** This event starts in ${reminder.label.replace("-", " ")}.`, ...announcementLines].join("\n"),
         primaryImageUrl, thumbnailImageUrl, current.target_channel_kind, current.target_channel_id,
         scheduledFor.toISOString(), changedBy, eventId, reminder.offsetMinutes]
      );
    }

    const newValues = {
      eventType, title, description, level: resolvedLevel, levelMax: requestedLevelMax, eventTimeZone,
      dutyId: selectedDuty?.id || null, mountId: selectedMount?.id || null,
      eventStartsAt: eventStartsAt.toISOString(), partyStrategy,
      partySize: Math.floor(partySize), standardPartyRolesRequired, checkInRequired, rosterLocked,
      reminder24Hours, reminder1Hour
    };
    await client.query(
      `insert into portal_discord_event_audit_log (
         event_id, action, changed_by, previous_values, new_values, created_at
       ) values ($1, 'updated', $2, $3::jsonb, $4::jsonb, now());`,
      [eventId, changedBy, JSON.stringify(previousValues), JSON.stringify(newValues)]
    );
    await rebalanceEventRoster(client, eventId);
    await queueDiscordEventRefresh(client, eventId, changedBy);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
async function updateEventPartySettings(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const eventId = Number(formData.get("eventId") || 0);
  const partyStrategy = String(formData.get("partyStrategy") || "rotation").trim();
  const partySize = Number(formData.get("partySize") || 8);
  const standardPartyRolesRequired = formData.get("standardPartyRolesRequired") === "on";
  const rosterLocked = formData.get("rosterLocked") === "on";
  if (!Number.isFinite(eventId) || eventId <= 0) throw new Error("A valid event is required.");
  if (!["rotation", "split"].includes(partyStrategy)) throw new Error("Choose Rotation or Split Teams.");
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 24) throw new Error("Party size must be between 1 and 24.");
  const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    const result = await client.query(
      `update portal_discord_events
       set party_strategy = $2, party_size = $3, standard_party_roles_required = $4,
           roster_locked = $5, updated_at = now()
       where id = $1 and status = 'planned' returning id;`,
      [eventId, partyStrategy, Math.floor(partySize), standardPartyRolesRequired, rosterLocked]
    );
    if (result.rows.length === 0) throw new Error("This event is no longer available.");
    await rebalanceEventRoster(client, eventId);
    await queueDiscordEventRefresh(client, eventId, requestedBy);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function updateEventAttendance(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const eventId = Number(formData.get("eventId") || 0);
  const characterId = Number(formData.get("characterId") || 0);
  const attendanceStatus = String(formData.get("attendanceStatus") || "").trim();
  const allowedStatuses = new Set(["not_checked_in", "present", "late", "left", "no_show"]);
  if (!Number.isFinite(eventId) || eventId <= 0 || !Number.isFinite(characterId) || characterId <= 0) {
    throw new Error("A valid event participant is required.");
  }
  if (!allowedStatuses.has(attendanceStatus)) throw new Error("Choose a valid attendance status.");
  const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    const result = await client.query(
      `update portal_discord_event_signups s
       set signup_status = case when $3 in ('present', 'late') then 'going' else s.signup_status end,
           attendance_status = $3,
           checked_in_at = case
             when $3 in ('present', 'late') then coalesce(s.checked_in_at, now())
             when $3 in ('not_checked_in', 'no_show') then null
             else s.checked_in_at
           end,
           attendance_updated_at = now(), attendance_updated_by = $4, updated_at = now()
       from portal_discord_events e
       where s.event_id = $1 and s.character_id = $2 and e.id = s.event_id
         and e.status in ('planned', 'expired', 'archived')
       returning s.character_id;`,
      [eventId, characterId, attendanceStatus, requestedBy]
    );
    if (result.rows.length === 0) throw new Error("This event participant could not be updated.");
    await rebalanceEventRoster(client, eventId);
    await queueDiscordEventRefresh(client, eventId, String(requestedBy));
    await client.query(
      `insert into portal_discord_event_audit_log (
         event_id, action, changed_by, previous_values, new_values, created_at
       ) values ($1, 'attendance_updated', $2, '{}'::jsonb, $3::jsonb, now());`,
      [eventId, requestedBy, JSON.stringify({ characterId, attendanceStatus })]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}

async function manageEventParticipant(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) throw new Error("Officer access is required.");
  const eventId = Number(formData.get("eventId") || 0);
  const characterId = Number(formData.get("characterId") || 0);
  const rosterAction = String(formData.get("rosterAction") || "").trim();
  if (!Number.isFinite(eventId) || eventId <= 0 || !Number.isFinite(characterId) || characterId <= 0) {
    throw new Error("A valid event participant is required.");
  }
  if (!["complete", "reactivate"].includes(rosterAction)) throw new Error("Choose a valid roster action.");
  const requestedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();
  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    if (rosterAction === "complete") {
      const result = await client.query(
        `update portal_discord_event_signups
         set roster_state = 'completed', party_number = null, completed_at = now(), completed_by = $3,
             attendance_status = case when attendance_status = 'not_checked_in' then 'present' else attendance_status end,
             checked_in_at = coalesce(checked_in_at, now()), attendance_updated_at = now(),
             attendance_updated_by = $3, updated_at = now()
         where event_id = $1 and character_id = $2 and signup_status = 'going' and roster_state = 'active'
         returning character_id;`,
        [eventId, characterId, requestedBy]
      );
      if (result.rows.length === 0) throw new Error("Only a participant in an active party can be marked complete.");
      const mountResult = await client.query(
        `select em.mount_id::int, m.mount_name, c.character_name
         from portal_discord_event_mounts em
         join portal_mounts m on m.id = em.mount_id
         join portal_characters c on c.id = $2
         where em.event_id = $1
         order by em.sort_order asc, em.mount_id asc
         limit 1;`,
        [eventId, characterId]
      );
      if (mountResult.rows.length > 0) {
        const mount = mountResult.rows[0];
        await client.query(
          `insert into portal_character_mounts (
             character_id, mount_id, owned, ownership_source, obtained_at, last_checked_at, updated_at
           ) values ($1, $2, true, 'event_roster', now(), now(), now())
           on conflict (character_id, mount_id) do update set
             owned = true,
             ownership_source = 'event_roster',
             obtained_at = coalesce(portal_character_mounts.obtained_at, now()),
             last_checked_at = now(),
             updated_at = now();`,
          [characterId, Number(mount.mount_id)]
        );
        await client.query(
          `insert into portal_mount_acquisitions (
             character_id, mount_id, character_name, mount_name, detected_at
           ) values ($1, $2, $3, $4, now())
           on conflict (character_id, mount_id) do nothing;`,
          [characterId, Number(mount.mount_id), String(mount.character_name), String(mount.mount_name)]
        );
      }
    } else {
      const result = await client.query(
        `update portal_discord_event_signups
         set roster_state = 'active', party_number = null, completed_at = null, completed_by = null, updated_at = now()
         where event_id = $1 and character_id = $2 and signup_status = 'going' and roster_state = 'completed'
         returning character_id;`,
        [eventId, characterId]
      );
      if (result.rows.length === 0) throw new Error("This participant is not confirmed Going.");
    }
    await rebalanceEventRoster(client, eventId);
    await queueDiscordEventRefresh(client, eventId, requestedBy);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  revalidatePath("/");
}
async function cancelDiscordEvent(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const eventId = Number(formData.get("eventId") || 0);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new Error("A valid event ID is required.");
  }

  const cancelledBy =
    session?.user?.email || session?.user?.name || "Unknown officer";

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        update portal_discord_events
        set
          status = 'cancelled',
          cancelled_at = now(),
          cancelled_by = $2,
          updated_at = now()
        where id = $1
          and status = 'planned';
      `,
      [eventId, cancelledBy]
    );
    await client.query(
      `update portal_discord_scheduled_posts
       set status = 'cancelled', cancelled_at = now(), cancelled_by = $2, updated_at = now()
       where status = 'scheduled'
         and (
           event_id = $1
           or id = (select announcement_scheduled_post_id from portal_discord_events where id = $1)
         );`,
      [eventId, cancelledBy]
    );
    await client.query(
      `insert into portal_discord_action_queue (
         discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at
       ) values ($1, 'refresh_event_roster', $2::jsonb, 'pending', $3, now(), now())
       on conflict (discord_user_id, action_type) where status = 'pending'
       do update set action_payload = excluded.action_payload,
                     requested_by = excluded.requested_by,
                     requested_at = now(),
                     updated_at = now();`,
      [`__event_${eventId}__`, JSON.stringify({ eventId }), cancelledBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function deleteDiscordEvent(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  if (!hasAnyGroup(groups, ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }

  const eventId = Number(formData.get("eventId") || 0);
  const confirmed = String(formData.get("confirmDelete") || "") === "yes";
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new Error("A valid event ID is required.");
  }
  if (!confirmed) {
    throw new Error("Confirm permanent deletion before continuing.");
  }

  const deletedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    await client.query("begin");
    try {
      const eventResult = await client.query(
        `select id::int, title, announcement_scheduled_post_id::int
         from portal_discord_events
         where id = $1
         for update;`,
        [eventId]
      );
      if (eventResult.rows.length === 0) {
        throw new Error("This event has already been deleted.");
      }

      const event = eventResult.rows[0];
      const postResult = await client.query(
        `select id::int, target_channel_kind, target_channel_id, sent_message_id
         from portal_discord_scheduled_posts
         where event_id = $1
            or id = $2
         order by id asc;`,
        [eventId, event.announcement_scheduled_post_id || 0]
      );
      const sentPosts = postResult.rows
        .filter((post) => String(post.sent_message_id || "").trim())
        .map((post) => ({
          scheduledPostId: Number(post.id),
          targetChannelKind: String(post.target_channel_kind || "event"),
          targetChannelId: String(post.target_channel_id || ""),
          sentMessageId: String(post.sent_message_id),
        }));

      await client.query(
        `update portal_discord_action_queue
         set status = 'cancelled', updated_at = now()
         where discord_user_id = $1
           and action_type = 'refresh_event_roster'
           and status = 'pending';`,
        [`__event_${eventId}__`]
      );

      if (sentPosts.length > 0) {
        await client.query(
          `insert into portal_discord_action_queue (
             discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at
           ) values ($1, 'delete_event_post', $2::jsonb, 'pending', $3, now(), now())
           on conflict (discord_user_id, action_type) where status = 'pending'
           do update set action_payload = excluded.action_payload,
                         requested_by = excluded.requested_by,
                         requested_at = now(),
                         updated_at = now();`,
          [
            `__event_delete_${eventId}__`,
            JSON.stringify({ eventId, eventTitle: String(event.title || "Untitled event"), posts: sentPosts }),
            deletedBy,
          ]
        );
      }

      await client.query(`delete from portal_discord_events where id = $1;`, [eventId]);
      await client.query(
        `delete from portal_discord_scheduled_posts
         where event_id = $1
            or id = any($2::bigint[]);`,
        [eventId, postResult.rows.map((post) => Number(post.id))]
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}
async function clearDiscordEvent(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);
  if (!isOfficer) throw new Error("Officer access is required.");

  const eventId = Number(formData.get("eventId") || 0);
  if (!Number.isFinite(eventId) || eventId <= 0) throw new Error("A valid event ID is required.");
  const archivedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    const result = await client.query(
      `update portal_discord_events
       set status = 'archived', archived_at = now(), archived_by = $2, updated_at = now()
       where id = $1 and status in ('cancelled', 'expired')
       returning id;`,
      [eventId, archivedBy]
    );
    if (result.rows.length === 0) throw new Error("Only cancelled or expired events can be cleared.");

    await client.query(
      `insert into portal_discord_action_queue (
         discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at
       ) values ($1, 'refresh_event_roster', $2::jsonb, 'pending', $3, now(), now())
       on conflict (discord_user_id, action_type) where status = 'pending'
       do update set action_payload = excluded.action_payload,
                     requested_by = excluded.requested_by,
                     requested_at = now(),
                     updated_at = now();`,
      [`__event_${eventId}__`, JSON.stringify({ eventId }), archivedBy]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function clearAllDiscordEvents() {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);
  if (!isOfficer) throw new Error("Officer access is required.");

  const archivedBy = session?.user?.email || session?.user?.name || "Unknown officer";
  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);
    await client.query("begin");

    try {
      const result = await client.query(
        `update portal_discord_events
         set status = 'archived', archived_at = now(), archived_by = $1, updated_at = now()
         where status in ('cancelled', 'expired')
         returning id::int;`,
        [archivedBy]
      );

      for (const row of result.rows) {
        const eventId = Number(row.id);
        await client.query(
          `insert into portal_discord_action_queue (
             discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at
           ) values ($1, 'refresh_event_roster', $2::jsonb, 'pending', $3, now(), now())
           on conflict (discord_user_id, action_type) where status = 'pending'
           do update set action_payload = excluded.action_payload,
                         requested_by = excluded.requested_by,
                         requested_at = now(),
                         updated_at = now();`,
          [`__event_${eventId}__`, JSON.stringify({ eventId }), archivedBy]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function saveDiscordDuty(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const clean = (key: string) => String(formData.get(key) || "").trim();

  const dutyType = clean("dutyType") || "trial";
  const name = clean("name");
  const expansion = clean("expansion");
  const imageUrl = clean("imageUrl");
  const notes = clean("notes");
  const levelValue = clean("level");
  const partySizeValue = clean("partySize");
  const sortOrderValue = clean("sortOrder");

  if (!name) {
    throw new Error("Duty/Raid name is required.");
  }

  const level = levelValue ? Number(levelValue) : null;

  if (level !== null && (!Number.isFinite(level) || level < 1 || level > 200)) {
    throw new Error("Level must be between 1 and 200.");
  }

  const partySize = partySizeValue ? Number(partySizeValue) : null;
  if (partySize !== null && (!Number.isFinite(partySize) || partySize < 1 || partySize > 24)) {
    throw new Error("Party size must be between 1 and 24.");
  }

  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Image URL must start with http:// or https://.");
  }

  const sortOrder = sortOrderValue ? Number(sortOrderValue) : 100;

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        insert into portal_discord_duties (
          duty_type,
          name,
          expansion,
          level,
          party_size,
          image_url,
          notes,
          active,
          sort_order,
                manual_override,
          created_at,
          updated_at
        )
           values ($1, $2, $3, $4, $5, $6, $7, true, $8, true, now(), now())
        on conflict (duty_type, name)
        do update set
          expansion = excluded.expansion,
          level = excluded.level,
          party_size = excluded.party_size,
          image_url = excluded.image_url,
          notes = excluded.notes,
          active = true,
          sort_order = excluded.sort_order,
          manual_override = true,
          updated_at = now();
      `,
      [
        dutyType,
        name,
        expansion || null,
        level,
        partySize,
        imageUrl || null,
        notes || null,
        Number.isFinite(sortOrder) ? sortOrder : 100
      ]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function hideDiscordDuty(formData: FormData) {
  "use server";

  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const isOfficer = hasAnyGroup(groups, ["Admins", "Guild Officers"]);

  if (!isOfficer) {
    throw new Error("Officer access is required.");
  }

  const dutyId = Number(formData.get("dutyId") || 0);

  if (!Number.isFinite(dutyId) || dutyId <= 0) {
    throw new Error("A valid duty ID is required.");
  }

  const client = await getDbClient();

  try {
    await ensurePortalSchema(client);

    await client.query(
      `
        update portal_discord_duties
        set
          active = false,
          updated_at = now()
        where id = $1;
      `,
      [dutyId]
    );
  } finally {
    await client.end();
  }

  revalidatePath("/");
}

async function getAnimeSyncStatus(): Promise<PortalAnimeSyncStatus> {
  const baseUrl = String(process.env.ANIME_SCHEDULE_URL || "").trim();
  const token = String(process.env.ANIME_SERVICE_API_TOKEN || "").trim();
  const unavailable = (error: string): PortalAnimeSyncStatus => ({
    available: false,
    error,
    timezone: "America/Chicago",
    dailySyncTime: "04:15",
    nextScheduledAt: null,
    backgroundSync: { status: "idle", startedAt: null, completedAt: null, error: null },
    sources: [],
    releases: { total: 0, sub: 0, dub: 0, upcoming_discord_window: 0, delayed: 0, last_catalog_update: null },
    recentRuns: [],
    outputs: [],
    discord: { enabled: false, languages: ["sub", "dub"], horizonDays: 3 },
    google: { enabled: false, dryRun: true, credentialsConfigured: false, languages: ["sub", "dub"], calendars: { sub: { configured: false }, dub: { configured: false } } },
    sourceConfiguration: { animeScheduleTokenConfigured: false, officialFeedCount: 0, ready: false },
  });
  if (!baseUrl || !token) return unavailable("Anime service connection is not configured.");
  try {
    const response = await fetch(new URL("/api/status", baseUrl), {
      headers: { "x-anime-service-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Anime service returned HTTP ${response.status}.`);
    return { ...payload, available: true, error: null } as PortalAnimeSyncStatus;
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

async function saveAnimeScheduleToken(formData: FormData) {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  let result: "success" | "error" = "success";
  let message = "AnimeSchedule token saved. You can run the first sync now.";
  try {
    const sourceToken = String(formData.get("animeScheduleToken") || "").trim();
    if (!sourceToken || sourceToken.length > 2048) throw new Error("Enter a valid AnimeSchedule application token.");
    const baseUrl = String(process.env.ANIME_SCHEDULE_URL || "").trim();
    const serviceToken = String(process.env.ANIME_SERVICE_API_TOKEN || "").trim();
    if (!baseUrl || !serviceToken) throw new Error("Anime service connection is not configured.");
    const response = await fetch(new URL("/api/settings/animeschedule-token", baseUrl), {
      method: "PUT",
      headers: { "content-type": "application/json", "x-anime-service-token": serviceToken },
      body: JSON.stringify({ token: sourceToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Anime service returned HTTP ${response.status}.`);
  } catch (error) {
    result = "error";
    message = error instanceof Error ? error.message : String(error);
  }
  revalidatePath("/");
  redirect(`/?view=officers&animeResult=${result}&animeMessage=${encodeURIComponent(message)}#officer-anime-sync`);
}

async function runAnimeScheduleSync() {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  let result: "success" | "error" = "success";
  let message = "Anime sync started. Refresh this panel shortly to see its progress.";
  try {
    const status = await getAnimeSyncStatus();
    if (!status.available) throw new Error(status.error || "Anime service connection is not configured.");
    if (!status.sourceConfiguration.ready) throw new Error("No anime source is configured. Save an AnimeSchedule application token in this panel and try again.");
    const baseUrl = String(process.env.ANIME_SCHEDULE_URL || "").trim();
    const token = String(process.env.ANIME_SERVICE_API_TOKEN || "").trim();
    const response = await fetch(new URL("/api/sync/start", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "x-anime-service-token": token },
      body: JSON.stringify({}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Anime sync returned HTTP ${response.status}.`);
    if (!payload.started) message = payload.backgroundSync?.error || "A sync is already running.";
  } catch (error) {
    result = "error";
    message = error instanceof Error ? error.message : String(error);
  }
  revalidatePath("/");
  redirect(`/?view=officers&animeResult=${result}&animeMessage=${encodeURIComponent(message)}#officer-anime-sync`);
}
async function testAnimeGoogleCalendars() {
  "use server";
  const session = (await auth()) as PortalSession;
  if (!hasAnyGroup(getUserGroupsFromSession(session), ["Admins", "Guild Officers"])) {
    throw new Error("Officer access is required.");
  }
  let result: "success" | "error" = "success";
  let message = "Google Calendar access and dry-run synchronization completed successfully.";
  try {
    const status = await getAnimeSyncStatus();
    if (!status.available) throw new Error(status.error || "Anime service connection is not configured.");
    const missingCalendars = status.google.languages.filter((language) => language === "sub" ? !status.google.calendars?.sub?.configured : language === "dub" ? !status.google.calendars?.dub?.configured : false);
    if (missingCalendars.length) throw new Error(`Add the ${missingCalendars.map((value) => value.toUpperCase()).join(" and ")} Google Calendar ID${missingCalendars.length === 1 ? "" : "s"} to .env before testing.`);
    if (!status.google.credentialsConfigured) throw new Error("Google service-account credentials are not configured. Add the JSON file under data/anime and set ANIME_GOOGLE_CREDENTIALS_FILE before testing.");
    const baseUrl = String(process.env.ANIME_SCHEDULE_URL || "").trim();
    const token = String(process.env.ANIME_SERVICE_API_TOKEN || "").trim();
    const response = await fetch(new URL("/api/outputs/google/test", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "x-anime-service-token": token },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Google Calendar test returned HTTP ${response.status}.`);
  } catch (error) {
    result = "error";
    message = error instanceof Error ? error.message : String(error);
  }
  revalidatePath("/");
  redirect(`/?view=officers&animeResult=${result}&animeMessage=${encodeURIComponent(message)}#officer-anime-sync`);
}
// =========================
// SECTION 07: Page Component
// =========================

// -------------------------
async function ensureCurrentPortalSchema() {
  const client = await getDbClient();
  try { await ensurePortalSchema(client); } finally { await client.end(); }
}

async function getCraftingActor(requireMember = false): Promise<CraftingActor> {
  const session = (await auth()) as PortalSession;
  const groups = getUserGroupsFromSession(session);
  const character = await getEligibleMemberCharacter(session);
  const actor: CraftingActor = { characterId: character?.id ?? null, characterName: character?.character_name ?? null, discordUserId: String(session?.user?.discordUserId ?? "").trim() || null, isOfficer: hasAnyGroup(groups, ["Admins", "Guild Officers"]) };
  if (requireMember && (!actor.characterId || !actor.discordUserId)) throw new Error("Crafting contributions and claims require a Discord-linked active FC character.");
  return actor;
}

async function createCraftingWorkshopProject(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await createDevelopmentWorkshopProject(await getCraftingActor(), formData); revalidatePath("/"); }
async function createCatalogCraftingProject(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await createCatalogCraftingRequest(await getCraftingActor(), formData); revalidatePath("/"); }
async function saveCraftingContribution(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await recordCraftingContribution(await getCraftingActor(true), formData); revalidatePath("/"); }
async function savePreviousCraftingPhaseProgress(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await recordPreviousPhaseProgress(await getCraftingActor(true), formData); revalidatePath("/"); }
async function postCraftingProjectToDiscord(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await publishCraftingProjectToDiscord(await getCraftingActor(), formData); revalidatePath("/"); }
async function saveCraftingClaim(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await createCraftingClaim(await getCraftingActor(true), formData); revalidatePath("/"); }
async function releaseMemberCraftingClaim(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await releaseCraftingClaim(await getCraftingActor(true), formData); revalidatePath("/"); }
async function removeCraftingWorkshopProject(formData: FormData) { "use server"; await ensureCurrentPortalSchema(); await deleteCraftingWorkshopProject(await getCraftingActor(), formData); revalidatePath("/"); }
// SUBSECTION 07A: HomePage entry point
// -------------------------

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{
  view?: string;
  gallery?: string;
  mountTab?: string;
  mountCategory?: string;
  mountSearch?: string;
  mountOwnership?: string;
  minionTab?: string;
  minionCategory?: string;
  minionSearch?: string;
  minionOwnership?: string;
  collectionSearch?: string;
  collectionType?: string;
  collectionCategory?: string;
  collectionPatch?: string;
  collectionAvailability?: string;
  collectionOwnership?: string;
  collectionGuide?: string;
  collectionPage?: string;
  memberSearch?: string;
  memberRole?: string;
  memberSyncStatus?: string;
  characterSearch?: string;
  roleFilter?: string;
  statusFilter?: string;
  detailCharacterId?: string;
  mountSetId?: string;
  mountTrackerSearch?: string;
  mountTrackerRole?: string;
  mountTrackerStatus?: string;
  partyCharacterId?: string | string[];
  partySearch?: string;
  managedMountSearch?: string;
  managedMountCategory?: string;
  managedMountPriority?: string;
  managedMountVisibility?: string;
  managedMountOverride?: string;
  craftProject?: string;
  craftPhase?: string;
  craftingTab?: string;
  calculator?: string;
  activitySearch?: string;
  activitySource?: string;
  activityOutcome?: string;
  activityWindow?: string;
  activityPage?: string;
  refreshDiscord?: string;
  animeResult?: string;
  animeMessage?: string;
  guide?: string;
  returnTo?: string;
  }>;
}) {
  if (isSetupMode()) redirect("/setup");
  const session = (await auth()) as PortalSession;
  const userGroups = getUserGroupsFromSession(session);

  const isSignedIn = Boolean(session?.user);
  const actualIsAdmin = userGroups.includes("Admins");
  const isEmulatingMember = actualIsAdmin && (await cookies()).get(portalMemberEmulationCookie)?.value === "1";
  const isAdmin = actualIsAdmin && !isEmulatingMember;
  const isOfficer = !isEmulatingMember && hasAnyGroup(userGroups, ["Admins", "Guild Officers"]);
  const eligibleMemberCharacter = isSignedIn
    ? await getEligibleMemberCharacter(session)
    : null;
  const isEligibleMember = Boolean(eligibleMemberCharacter);
  const memberCharacterChoices = isEligibleMember ? await getMemberCharacterChoices(session) : [];
  const canAccessMemberContent = isEligibleMember || isOfficer;
  const primaryAdminDiscordIds = installationPrimaryAdminDiscordId ? [installationPrimaryAdminDiscordId] : [];


  // SUBSECTION 07B: Resolve URL search params
  const resolvedSearchParams = (await searchParams) ?? {};

  const getSearchParam = (key: keyof typeof resolvedSearchParams) => {
    const value = resolvedSearchParams[key];

    if (Array.isArray(value)) {
      return String(value[0] ?? "").trim();
    }

    return String(value ?? "").trim();
  };

  const getSearchParamList = (key: keyof typeof resolvedSearchParams) => {
    const value = resolvedSearchParams[key];

    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    const singleValue = String(value ?? "").trim();

    return singleValue ? [singleValue] : [];
  };


  const memberPreferences = isEligibleMember && eligibleMemberCharacter
    ? await getMemberPreferences(session, eligibleMemberCharacter)
    : null;

  // SUBSECTION 07C: View routing and access guards
  const validPortalViews: PortalView[] = [
    "home",
    "announcements",
    "polls",
    "events",
    "crafting",
    "calculators",
    "guides",
    "members",
    "mounts",
    "minions",
    "titles",
    "achievements",
    "anime",
    "giveaways",
    "fc-info",
    "links",
    "gallery",
    "settings",
    "officers"
  ];

  const requestedView = getSearchParam("view");
  const normalizedRequestedView = requestedView === "raiding" ? "events" : requestedView;
  const preferredLandingView = memberPreferences?.defaultLandingView || "home";
  let activeView: PortalView = validPortalViews.includes(normalizedRequestedView as PortalView)
    ? (normalizedRequestedView as PortalView)
    : (validPortalViews.includes(preferredLandingView as PortalView) ? preferredLandingView as PortalView : "home");
  const activeCalculator = getSearchParam("calculator") || "crafting";

  const requestedGalleryCategory = getSearchParam("gallery");
  const activeGalleryCategory: "gaming_setup" | "pet" | "glamour" | "artwork" = requestedGalleryCategory === "pet" || requestedGalleryCategory === "glamour" || requestedGalleryCategory === "artwork" ? requestedGalleryCategory : "gaming_setup";
  const requestedMountTab = getSearchParam("mountTab");
  const activeMountTab = requestedMountTab === "marketboard" || requestedMountTab === "collection" || requestedMountTab === "guide"
    ? requestedMountTab
    : (memberPreferences?.defaultMountTab || "collection");
  const requestedMountCategory = getSearchParam("mountCategory");
  const activeMountCategory = Object.prototype.hasOwnProperty.call(MOUNT_CATEGORY_METADATA, requestedMountCategory) ? requestedMountCategory : "";
  const activeMountSearch = getSearchParam("mountSearch");
  const hideOwnedMountGuide = getSearchParam("mountOwnership") ? getSearchParam("mountOwnership") === "missing" : (memberPreferences?.hideOwnedMounts ?? false);
  const mountOwnershipToggleHref = `/?view=mounts&mountTab=guide${activeMountCategory ? `&mountCategory=${activeMountCategory}` : ""}${activeMountSearch ? `&mountSearch=${encodeURIComponent(activeMountSearch)}` : ""}${hideOwnedMountGuide ? "&mountOwnership=all" : "&mountOwnership=missing"}#mount-guide`;
  const requestedMinionTab = getSearchParam("minionTab");
  const activeMinionTab = requestedMinionTab === "marketboard" || requestedMinionTab === "collection"
    ? requestedMinionTab
    : (memberPreferences?.defaultMinionTab || "collection");
  const requestedMinionCategory = getSearchParam("minionCategory");
  const preferredMinionCategory = requestedMinionCategory || memberPreferences?.defaultMinionCategory || "";
  const activeMinionCategory = ["farmable", "gathering", "gardening", "crafting", "tribal", "island_sanctuary", "pvp", "event", "quest", "vendor", "premium", "achievement", "gold_saucer", "other"].includes(preferredMinionCategory)
    ? preferredMinionCategory
    : "";
  const activeMinionSearch = getSearchParam("minionSearch");
  const hideOwnedMinions = getSearchParam("minionOwnership")
    ? getSearchParam("minionOwnership") === "missing"
    : (memberPreferences?.hideOwnedMinions ?? false);
  const minionOwnershipSuffix = hideOwnedMinions ? "&minionOwnership=missing" : "";
  const minionOwnershipToggleHref = `/?view=minions&minionTab=collection${activeMinionCategory ? `&minionCategory=${activeMinionCategory}` : ""}${activeMinionSearch ? `&minionSearch=${encodeURIComponent(activeMinionSearch)}` : ""}${hideOwnedMinions ? "&minionOwnership=all" : "&minionOwnership=missing"}#minions`;
  const requestedCollectionOwnership = getSearchParam("collectionOwnership");
  const requestedCollectionGuide = getSearchParam("collectionGuide");
  const collectionFilters: CollectionFilters = {
    search: getSearchParam("collectionSearch"), type: getSearchParam("collectionType"), category: getSearchParam("collectionCategory"), patch: getSearchParam("collectionPatch"), availability: getSearchParam("collectionAvailability"),
    ownership: eligibleMemberCharacter && (requestedCollectionOwnership === "owned" || requestedCollectionOwnership === "missing") ? requestedCollectionOwnership : eligibleMemberCharacter && ((activeView === "titles" && memberPreferences?.hideOwnedTitles) || (activeView === "achievements" && memberPreferences?.hideOwnedAchievements)) ? "missing" : "all",
    guide: requestedCollectionGuide === "detailed" || requestedCollectionGuide === "category" || requestedCollectionGuide === "none" ? requestedCollectionGuide : "all",
    page: Math.max(1, Number.parseInt(getSearchParam("collectionPage") || "1", 10) || 1)
  };

  if (activeView === "officers" && !isOfficer) {
    activeView = "home";
  }

  if (activeView === "settings" && !isEligibleMember) {
    activeView = "home";
  }

  if (
    !canAccessMemberContent &&
    !["home", "announcements", "polls", "events", "giveaways", "mounts", "minions", "titles", "achievements", "anime", "fc-info", "links", "gallery"].includes(activeView)
  ) {
    activeView = "home";
  }


  // SUBSECTION 07D: Filter state
  const managedMountFilters: PortalManagedMountFilters = {
    search: getSearchParam("managedMountSearch"),
    category: getSearchParam("managedMountCategory"),
    farmPriority: getSearchParam("managedMountPriority"),
    visibility: getSearchParam("managedMountVisibility"),
    overrideStatus: getSearchParam("managedMountOverride")
  };

  const mountTrackerFilters: PortalMountTrackerFilters = {
  search: getSearchParam("mountTrackerSearch"),
  role: getSearchParam("mountTrackerRole"),
  syncStatus: getSearchParam("mountTrackerStatus")
};

  const memberDirectoryFilters: PortalMemberDirectoryFilters = {
  search: getSearchParam("memberSearch"),
  role: getSearchParam("memberRole"),
  syncStatus: getSearchParam("memberSyncStatus")
};

  const partySearch = getSearchParam("partySearch");
  
  const detailCharacterId = Number.parseInt(
    resolvedSearchParams.detailCharacterId ?? "",
    10
  );
  
  const selectedMountSetId = Number.parseInt(
    resolvedSearchParams.mountSetId ?? "",
    10
  );


  const selectedCraftingProjectId = Number.parseInt(getSearchParam("craftProject"), 10);
  const selectedCraftingPhaseNumber = Number.parseInt(getSearchParam("craftPhase"), 10);
  // SUBSECTION 07E: Party and mount selection state
  const selectedPartyCharacterIds = getSearchParamList("partyCharacterId")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 8);

const buildMountTrackerHref = (mountSetId?: number | null, anchor = "mounts") => {
    const params = new URLSearchParams();

    params.set("view", "mounts");

    if (Number.isFinite(mountSetId) && mountSetId && mountSetId > 0) {
      params.set("mountSetId", String(mountSetId));
    }

    for (const characterId of selectedPartyCharacterIds) {
      params.append("partyCharacterId", String(characterId));
    }

    if (mountTrackerFilters.search) {
      params.set("mountTrackerSearch", mountTrackerFilters.search);
    }

    if (mountTrackerFilters.role) {
      params.set("mountTrackerRole", mountTrackerFilters.role);
    }

    if (mountTrackerFilters.syncStatus) {
      params.set("mountTrackerStatus", mountTrackerFilters.syncStatus);
    }

    const queryString = params.toString();

    return queryString ? `/?${queryString}#${anchor}` : `/#${anchor}`;
  };


  // SUBSECTION 07G: Database-backed page data
  const giveawayPageData = activeView === "giveaways"
    ? await (async () => {
        const client = await getDbClient();
        try {
          await ensurePortalSchema(client);
          const discordUserId = String(session?.user?.discordUserId ?? "").trim() || null;
          const eligibility = await getGiveawayEligibility(client, discordUserId);
          const dashboard = await getGiveawayDashboard(client, discordUserId, isOfficer);
          return { dashboard, eligibility };
        } finally { await client.end(); }
      })()
    : null;
  const db = await getDatabaseStatus();
  const settings = await getPortalSettings();
  const protectedPortalAdminDiscordIds = new Set([
    ...primaryAdminDiscordIds,
    ...settings.additionalAdminDiscordIds.split(",").map((value) => value.trim()).filter(Boolean),
  ]);
  const canShowDiscordInvite = Boolean(settings.discordInviteUrl) && (settings.discordInvitePublic || canAccessMemberContent);
  const craftingWorkshopData = canAccessMemberContent && activeView === "crafting"
    ? await getCraftingWorkshopDashboard({
        projectId: Number.isFinite(selectedCraftingProjectId) && selectedCraftingProjectId > 0 ? selectedCraftingProjectId : undefined,
        phaseNumber: Number.isFinite(selectedCraftingPhaseNumber) && selectedCraftingPhaseNumber > 0 ? selectedCraftingPhaseNumber : undefined
      })
    : null;
  const portalAnnouncements = await getPortalAnnouncements();
  const communityGalleryPosts = activeView === "gallery"
    ? await getCommunityGalleryPosts(activeGalleryCategory, isOfficer, isEligibleMember || isOfficer)
    : [];
  const communityGalleryImports = isOfficer ? await getCommunityGalleryImportRequests() : [];

  const announcementEvents = await getAnnouncementEvents();
  const announcementRenames = await getAnnouncementRenames();
  const guideResources = await getGuideResources(isEligibleMember || isOfficer);
  const selectedGuideSlug = getSearchParam("guide");
  const requestedGuideReturnHref = getSearchParam("returnTo");
  const guideReturnHref = ["/?view=titles", "/?view=achievements", "/?view=mounts", "/?view=minions"].some((prefix) => requestedGuideReturnHref.startsWith(prefix)) && !requestedGuideReturnHref.includes("\\") && !requestedGuideReturnHref.startsWith("//")
    ? requestedGuideReturnHref
    : undefined;
  const fcInfoCards = await getFcInfoCards();
  const fcInfoLead = await getFcInfoLead();
  const fcGalleryImages = await getFcGalleryImages();
  const managedLinkCards = await getPortalLinkCards();
  const publicRaidEvents = announcementEvents.filter((event) => ["raid", "mount_farm"].includes(event.event_type));
  const identityShadowStatus = isSignedIn
    ? await getPortalIdentityShadowStatus(session)
    : null;
  const roles = canAccessMemberContent ? await getRoles() : [];
  const characters = canAccessMemberContent ? await getCharacters() : [];
  const memberDirectoryCharacters = canAccessMemberContent
    ? await getMemberDirectory({ ...memberDirectoryFilters, search: "" })
    : [];

  const activityWindow = Number.parseInt(getSearchParam("activityWindow"), 10);
  const activityFilters: OfficerActivityFilters = { search: getSearchParam("activitySearch"), source: getSearchParam("activitySource") || "all", outcome: getSearchParam("activityOutcome") || "all", windowDays: [1,7,30,90].includes(activityWindow) ? activityWindow : 30 };
  const activityPage = Math.max(1, Number.parseInt(getSearchParam("activityPage"), 10) || 1);
  const officerActivityLog = isOfficer && activeView === "officers" ? await getOfficerActivityLog(activityFilters, activityPage) : { entries: [], total: 0, page: 1, pageSize: 25, totalPages: 1, filters: activityFilters, sources: [], usage: [] };
  const animeSyncStatus = isOfficer && activeView === "officers" ? await getAnimeSyncStatus() : null;
  const fcVerification = isOfficer && activeView === "officers" ? await getFcVerificationStatus() : null;
  const backupJobs = isAdmin && activeView === "officers"
    ? await (async () => {
        const client = await getDbClient();
        try {
          await ensurePortalSchema(client);
          return await getPortalBackupJobs(client);
        } finally {
          await client.end();
        }
      })()
    : [];
  const animeActionResult = getSearchParam("animeResult");
  const animeActionMessage = getSearchParam("animeMessage");
  const animeSourceReady = Boolean(animeSyncStatus?.sourceConfiguration?.ready);
  const animeGoogleCalendarReady = Boolean(
    animeSyncStatus?.google.languages.every((language) => language === "sub"
      ? animeSyncStatus.google.calendars?.sub?.configured
      : language === "dub"
        ? animeSyncStatus.google.calendars?.dub?.configured
        : true)
  );
  const animeGoogleReady = Boolean(animeSyncStatus?.google.credentialsConfigured && animeGoogleCalendarReady);
  const joinDateCharacters = isOfficer ? await getJoinDateCharacters() : [];
  const discordLinks = isOfficer ? await getDiscordLinks() : [];
  const discordAuditLogs = isOfficer ? await getDiscordAuditLogs() : [];
   const characterRenameReviews = isOfficer ? await getCharacterRenameReviews() : [];
  const discordBotSettings = isOfficer || activeView === "events" ? await getDiscordBotSettings() : null;
  const altCharacterMembers = isOfficer && discordBotSettings ? await getAltCharacterMembers(discordBotSettings.alt_character_default_limit) : [];
  const animeDiscordSchedulingEnabled = discordBotSettings?.anime_event_scheduling_enabled
    ?? Boolean(animeSyncStatus?.discord.enabled);
  const discordResourceDiscovery = isOfficer && discordBotSettings
    ? await getDiscordResourceDiscovery(discordBotSettings, getSearchParam("refreshDiscord") === "1")
    : null;
  const eventPlanDestinations = activeView === "events" && discordBotSettings && session?.user?.discordUserId
    ? await (async () => {
        try {
          const channels = await getAvailableDiscordPostChannels({
            guildId: discordBotSettings.guild_id,
            userId: String(session.user.discordUserId),
            preferredChannelId: discordBotSettings.event_channel_id
          });
          if (channels.length > 0) return channels;
        } catch (error) {
          console.warn("[events] Discord channel discovery failed; using Party Planner fallback.", error);
        }
        return discordBotSettings.event_channel_id
          ? [{ id: discordBotSettings.event_channel_id, label: "Party Planner" }]
          : [];
      })()
    : [];
  const pollPageData = activeView === "polls"
    ? await (async () => {
        const client = await getDbClient();
        try {
          await ensurePortalSchema(client);
          const discordUserId = String(session?.user?.discordUserId ?? "").trim() || null;
          const eligibility = await getPollEligibility(client, discordUserId);
          const dashboard = await getPollDashboard(client, discordUserId, isOfficer);
          return { dashboard, eligibility };
        } finally { await client.end(); }
      })()
    : null;
  const discordRosterScanStatus = isOfficer
    ? await getDiscordRosterScanStatus(discordBotSettings)
    : null;
  const discordScheduledPosts = isOfficer
    ? await getDiscordScheduledPosts()
    : [];
  const memberEventsData = canAccessMemberContent
    ? await getMemberEvents(eligibleMemberCharacter,50,String(session?.user?.discordUserId||""))
    : { character: null, events: [] };
  const personalAttendanceHistory = memberEventsData.events.reduce(
    (history, event) => {
      if (event.status === "planned" || !event.current_signup) return history;
      const status = event.current_signup.attendance_status;
      if (["present", "late", "left"].includes(status)) history.attended += 1;
      if (status === "late") history.late += 1;
      if (status === "no_show") history.noShow += 1;
      history.recorded += status === "not_checked_in" ? 0 : 1;
      return history;
    },
    { attended: 0, late: 0, noShow: 0, recorded: 0 }
  );
  const discordEvents = isOfficer ? await getDiscordEvents() : [];
  const eventTemplates = isOfficer ? await getEventTemplates() : [];
  const eventSeries = isOfficer ? await getEventSeries() : [];

  const discordEventMountOptions = canAccessMemberContent
    ? await getDiscordEventMountOptions()
    : [];
  const discordDuties = canAccessMemberContent ? await getDiscordDuties() : [];
  const discordRosterReviews = isOfficer ? await getDiscordRosterReviews() : [];
  const discordMemberSnapshotReviews = isOfficer
    ? await getDiscordMemberSnapshotReviews()
    : [];
  const discordActionQueue = isOfficer ? await getDiscordActionQueue() : [];
  const discordQueueStats = isOfficer
    ? await getDiscordActionQueueStats()
    : {
        pending: 0,
        needs_confirmation: 0,
        processing: 0,
        failed: 0,
        completed: 0,
        cancelled: 0,
        total_open: 0
      };

  const scheduledPostDefaultChannelKind = discordBotSettings?.event_channel_id
    ? "event"
    : discordBotSettings?.officer_log_channel_id
          ? "officer_log"
          : discordBotSettings?.test_channel_id
            ? "test"
            : "event";

  const syncRuns = isOfficer ? await getSyncRuns() : [];
  const collectionSourceWarnings = isOfficer ? await getCollectionSourceWarnings() : [];
  const fcRosterAuditChanges = isOfficer ? await getFcRosterAuditChanges() : [];
  const managedMounts = isOfficer ? await getManagedMounts(managedMountFilters) : [];
  const mountWinTestOptions = isOfficer ? await getMountWinTestOptions() : [];
  const partyCharacterOptions = canAccessMemberContent ? await getPartyCharacterOptions() : [];
  const partyFarmTargets = canAccessMemberContent
    ? await getPartyFarmTargets(
        selectedPartyCharacterIds,
        Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
          ? selectedMountSetId
          : undefined
      )
    : [];
  const recentMountAcquisitions = await getRecentMountAcquisitions();
  const marketboardMounts = activeView === "mounts" && activeMountTab === "marketboard" ? await getMarketboardMounts(eligibleMemberCharacter?.id ?? null) : [];
  const isMountGuideView = activeView === "mounts" && activeMountTab === "guide";
  const mountGuideStats = canAccessMemberContent && isMountGuideView ? await getMountGuideStats() : null;
  const mountCategoryProgress = canAccessMemberContent && isMountGuideView ? await getMountCategoryProgress(eligibleMemberCharacter?.id ?? null, hideOwnedMountGuide) : [];
  const visibleMountCategoryCount = mountCategoryProgress.reduce((total, category) => total + category.mount_count, 0);
  const mountAcquisitionCatalog = canAccessMemberContent && isMountGuideView ? await getMountAcquisitionCatalog(eligibleMemberCharacter?.id ?? null, activeMountCategory, hideOwnedMountGuide) : [];
  const marketboardMinions = activeView === "minions" && activeMinionTab === "marketboard"
    ? await getMarketboardMinions(eligibleMemberCharacter?.id ?? null)
    : [];
  const collectionCatalog = activeView === "titles" || activeView === "achievements"
    ? await getPersonalCollectionPage(activeView, eligibleMemberCharacter?.id ?? null, collectionFilters)
    : null;
  const isMinionCollectionView = activeView === "minions" && activeMinionTab === "collection";
  const minionTrackerStats = canAccessMemberContent && isMinionCollectionView
    ? await getMinionTrackerStats()
    : null;
  const minionCategoryProgress = canAccessMemberContent && isMinionCollectionView
    ? await getMinionCategoryProgress(eligibleMemberCharacter?.id ?? null, hideOwnedMinions)
    : [];
  const visibleMinionCategoryCount = minionCategoryProgress.reduce((total, category) => total + category.minion_count, 0);
  const minionAcquisitionCatalog = canAccessMemberContent && isMinionCollectionView
    ? await getMinionAcquisitionCatalog(
        eligibleMemberCharacter?.id ?? null,
        activeMinionCategory,
        "",
        hideOwnedMinions,
        1000
      )
    : [];
  const mountSetSummaries = await getMountSetSummaries();
  const mountSetProgress = await getMountSetProgress();
  const mountTrackerStats = await getMountTrackerStats();
  const characterMountProgress =
    canAccessMemberContent && Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
      ? await getCharacterMountProgress(150, selectedMountSetId, { ...mountTrackerFilters, search: "" })
      : canAccessMemberContent
        ? await getCharacterMountProgress(150, undefined, { ...mountTrackerFilters, search: "" })
        : [];

  const mostNeededMounts =
    canAccessMemberContent && Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
      ? await getMostNeededMounts(12, selectedMountSetId)
      : canAccessMemberContent
        ? await getMostNeededMounts()
        : [];
  
  const selectedCharacterMountDetails =
    canAccessMemberContent && Number.isFinite(detailCharacterId) && detailCharacterId > 0
      ? await getCharacterMountDetails(
          detailCharacterId,
          Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
            ? selectedMountSetId
            : undefined
        )
      : null;

  const totalActiveMounts = mountSetSummaries.reduce(
    (total, mountSet) => total + mountSet.active_mount_count,
    0
  );
  
    const selectedMountSet =
    Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
      ? mountSetProgress.find((mountSet) => mountSet.id === selectedMountSetId)
      : null;

  const displayName =
    session?.user?.name ||
    session?.user?.email ||
    "Signed-in member";

  const portalAppearanceClasses = [
    "guild-app",
    memberPreferences?.motionPreference === "off" ? "member-reduced-motion" : "",
    memberPreferences?.layoutDensity === "compact" ? "member-compact-layout" : "",
    memberPreferences?.textScale === "medium" ? "member-medium-text" : "",
    memberPreferences?.textScale === "large" ? "member-large-text" : "",
    memberPreferences?.highContrastEnabled ? "member-high-contrast" : "",
    memberPreferences?.dataSaverEnabled ? "member-data-saver" : "",
    memberPreferences?.cardFlipEnabled === false ? "member-card-flips-disabled" : ""
  ].filter(Boolean).join(" ");

  const orderedMemberNavItems = orderNavigationItems(memberNavItems, settings.navigationOrder);
  const navItems = canAccessMemberContent
    ? (isEligibleMember ? orderedMemberNavItems : orderedMemberNavItems.filter((item) => item.view !== "settings"))
    : orderNavigationItems(publicNavItems, settings.navigationOrder);

  const themeEditorRoles: ThemeEditorRole[] = [
    { key: "backgroundColor", label: "Page background", description: "Blend the top color into an optional second color toward the bottom of every page.", variable: "--theme-page", color: settings.backgroundColor, secondary: { key: "backgroundSecondaryColor", label: "Bottom fade color", variable: "--theme-page-secondary", color: settings.backgroundSecondaryColor } },
    { key: "sidebarColor", label: "Sidebar", description: "The navigation rail and its surrounding surface.", variable: "--theme-sidebar", color: settings.sidebarColor },
    { key: "tileColor", label: "Panels and cards", description: "Primary cards, panels, dashboards, and content blocks.", variable: "--theme-surface", color: settings.tileColor },
    { key: "insetColor", label: "Nested panels and fields", description: "Inputs, secondary buttons, rows, and panels inside larger cards.", variable: "--theme-inset", color: settings.insetColor },
    { key: "borderColor", label: "Borders and outlines", description: "Outlines around cards, fields, buttons, and dividers.", variable: "--theme-border", color: settings.borderColor },
    { key: "accentColor", label: "Buttons and highlights", description: "Primary actions, selected states, and interactive highlights.", variable: "--theme-accent", color: settings.accentColor },
    { key: "labelColor", label: "Labels and badges", description: "Section labels, neutral badges, and small decorative accents.", variable: "--theme-label", color: settings.labelColor },
    { key: "headingColor", label: "Headings", description: "Page titles and card headings.", variable: "--theme-heading", color: settings.headingColor },
    { key: "textColor", label: "Body text", description: "Standard readable text throughout the portal.", variable: "--theme-text", color: settings.textColor },
    { key: "mutedTextColor", label: "Secondary text", description: "Descriptions, timestamps, hints, and less prominent text.", variable: "--theme-muted", color: settings.mutedTextColor }
  ];


  // SUBSECTION 07H: Render page shell and active view
  return (
    <main
      className={portalAppearanceClasses}
      style={{
        "--installation-background": settings.backgroundColor,
        "--accent": settings.accentColor,
        "--purple": settings.accentColor,
        "--tile-color": settings.tileColor,
        "--theme-page": settings.backgroundColor,
        "--theme-page-secondary": settings.backgroundSecondaryColor,
        "--theme-sidebar": settings.sidebarColor,
        "--theme-surface": settings.tileColor,
        "--theme-inset": settings.insetColor,
        "--theme-border": settings.borderColor,
        "--theme-accent": settings.accentColor,
        "--theme-label": settings.labelColor,
        "--theme-heading": settings.headingColor,
        "--theme-text": settings.textColor,
        "--theme-muted": settings.mutedTextColor
      } as CSSProperties}
    >
      <InteractiveFormEnhancer />
      {/* ========================= */}
      {/* SECTION: Sidebar */}
      {/* ========================= */}

      <ResponsiveSidebar logoUrl={settings.logoUrl} portalName={installationPortalName} portalSubtitle={installationPortalSubtitle}>
        <nav className="side-nav" aria-label="Guild navigation">
          {navItems.map((item) => (["gallery", "mounts", "minions", "calculators"].includes(item.view)) ? (
            <details key={item.label} data-nav-key={item.view} className={`side-nav-submenu ${(item.label === "Collections" ? ["mounts","minions","titles","achievements"].includes(activeView) : item.view === activeView) ? "active" : ""}`} open={item.label === "Collections" ? ["mounts","minions","titles","achievements"].includes(activeView) : item.view === activeView}>
              <summary>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                <span className="side-nav-submenu-caret" aria-hidden="true">v</span>
              </summary>
              <div className="side-nav-submenu-links">
                {item.label === "Collections" ? (
                  <>
                    <a href="/?view=mounts&mountTab=collection" className={activeView === "mounts" ? "active" : ""}>Mounts</a>
                    <a href="/?view=minions&minionTab=collection" className={activeView === "minions" ? "active" : ""}>Minions</a>
                    <a href="/?view=titles" className={activeView === "titles" ? "active" : ""}>Titles</a>
                    <a href="/?view=achievements" className={activeView === "achievements" ? "active" : ""}>Achievements</a>
                  </>
                ) : item.view === "calculators" ? (
                  <>
                    <a href="/?view=calculators&calculator=crafting">Crafting Macro</a>
                    <a href="/?view=calculators&calculator=chocobo">Chocobo Color</a>
                    <a href="/?view=calculators&calculator=treasure-map">Treasure Maps</a>
                    <a href="/?view=calculators&calculator=squadron">Squadron Mission</a>
                    <a href="/?view=calculators&calculator=submarine">Submarine Build</a>
                    <a href="/?view=calculators&calculator=materia">Materia &amp; Stats</a>
                    <a href="/?view=calculators&calculator=gathering">Gathering</a>
                    <a href="/?view=calculators&calculator=relic">Relic &amp; Currency</a>
                  </>
                ) : item.view === "minions" ? (
                  <>
                    <a href="/?view=minions&minionTab=collection" className={activeView === "minions" && activeMinionTab === "collection" ? "active" : ""}>Minion Collection Progress</a>
                    <a href="/?view=minions&minionTab=marketboard" className={activeView === "minions" && activeMinionTab === "marketboard" ? "active" : ""}>Marketboard Minions</a>
                  </>
                ) : (
                  <>
                    <a href="/?view=gallery&gallery=gaming_setup" className={activeView === "gallery" && activeGalleryCategory === "gaming_setup" ? "active" : ""}>Gaming Setups</a>
                    <a href="/?view=gallery&gallery=pet" className={activeView === "gallery" && activeGalleryCategory === "pet" ? "active" : ""}>Fur Babies</a>
                    <a href="/?view=gallery&gallery=glamour" className={activeView === "gallery" && activeGalleryCategory === "glamour" ? "active" : ""}>Glamours</a>
                    <a href="/?view=gallery&gallery=artwork" className={activeView === "gallery" && activeGalleryCategory === "artwork" ? "active" : ""}>Artwork</a>
                  </>
                )}
              </div>
            </details>
          ) : (
            <a key={item.label} data-nav-key={item.view} href={`/?view=${item.view}`} className={item.view === activeView ? "active" : ""}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

{isOfficer ? (
  <>
    <a
      className={activeView === "officers" ? "officer-link active" : "officer-link"}
      href="/?view=officers#officers"
    >
      <span>{"\u2691"}</span>
      Officer Area
    </a>
  </>
) : null}
</ResponsiveSidebar>

      <section className="content-shell">
        {/* ========================= */}
        {/* SECTION: Topbar */}
        {/* ========================= */}

        <header className="topbar">
          <div>
            <p className="eyebrow">{installationPortalSubtitle}</p>
            <h1>{installationPortalName}</h1>
          </div>

          <div className="topbar-actions">
            {isOfficer ? <ThemeEditor roles={themeEditorRoles} saveAction={savePortalThemeColor} navigationItems={memberNavItems.map((item) => ({ key: item.view, label: item.label }))} navigationOrder={normalizeNavigationOrder(settings.navigationOrder)} saveNavigationAction={savePortalNavigationOrder} /> : null}
            {session?.user ? (
              <div className="user-pill">
                <div>
                  <span>Signed in as</span>
                  <strong>{displayName}</strong>
                </div>

                {memberCharacterChoices.length > 1 || actualIsAdmin ? <CharacterSwitcher characters={memberCharacterChoices} activeCharacterId={eligibleMemberCharacter?.id ?? null} switchAction={switchCharacterAction} canEmulateMember={actualIsAdmin} isEmulatingMember={isEmulatingMember} emulationAction={setMemberEmulationAction} returnTo={`/?view=${activeView}`} /> : null}

                <form action={logoutAction}>
                  <button className="top-action-button" type="submit">
                    Log out
                  </button>
                </form>
              </div>
            ) : (
              <form action={loginAction}>
                <button className="top-action-button login" type="submit">
                  Member Login
                </button>
              </form>
            )}
          </div>
        </header>

        {/* ========================= */}
        {/* SECTION: Hero */}
        {/* ========================= */}

        <section
          id="home"
          className="hero"
          hidden={activeView !== "home"}
          style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 0, 12, 0.82) 0%, rgba(5, 0, 12, 0.34) 48%, rgba(5, 0, 12, 0.62) 100%), url(${JSON.stringify(settings.bannerUrl)})` }}
        >
          <div className="hero-overlay" />

          <div className="hero-content">
            <p className="eyebrow">A Home Among Friends</p>
            <h2>{installationPortalName}</h2>
            <p className="subtitle">{settings.welcomeText}</p>

            <div className="hero-actions">
              {canAccessMemberContent ? (
                <a href="/?view=mounts" className="button primary">
                  View Mount Tracker
                </a>
              ) : (
                <form action={loginAction}>
                  <button className="button primary" type="submit">
                    Enter the Grove
                  </button>
                </form>
              )}

              {canShowDiscordInvite ? (
                <a
                  href={settings.discordInviteUrl}
                  className="button secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Discord
                </a>
              ) : null}

              {settings.lodestoneUrl ? (
                <a
                  href={settings.lodestoneUrl}
                  className="button secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  FC Lodestone
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* ========================= */}
        {/* SECTION: Announcements */}
        {/* ========================= */}

        <section id="announcements" className="section-block" hidden={activeView !== "announcements"}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Community Feed</p>
              <h2>Announcements</h2>
              <p>FC news, upcoming adventures, mount wins, and character updates in one public place.</p>
            </div>
          </div>

          <div className="card-grid three">
            <article className="panel">
              <span className="tag">Portal Notice</span>
              <h3>{installationPortalName}</h3>
              <p>{settings.announcementText}</p>
            </article>

            {portalAnnouncements.map((announcement) => (
              <article key={announcement.id} className="panel">
                <span className="tag">{announcement.category}</span>
                <h3>{announcement.title}</h3>
                <p>{announcement.body}</p>
                <small>{formatShortDateTime(announcement.published_at)}</small>
              </article>
            ))}
          </div>

          <div className="section-title-row">
            <div>
              <p className="eyebrow">Calendar</p>
              <h3>Upcoming FC Events</h3>
            </div>
            {canAccessMemberContent ? <a href="/?view=events" className="small-link">Open Events</a> : null}
          </div>
          <div className="card-grid three">
            {announcementEvents.length > 0 ? announcementEvents.map((event) => (
              <article key={event.id} className="panel">
                <span className="tag">{event.event_type.replaceAll("_", " ")}</span>
                <h3>{event.title}</h3>
                <p>{formatShortDateTime(event.event_starts_at)}{event.duty_name ? ` · ${event.duty_name}` : ""}</p>
                {event.mount_name ? <p><strong>Mount target:</strong> {event.mount_name}</p> : null}
                {event.description ? <p>{event.description}</p> : null}
              </article>
            )) : (
              <article className="panel">
                <span className="tag">Calendar</span>
                <h3>No upcoming events yet</h3>
                <p>New raids, trials, mount farms, and community gatherings will appear here.</p>
              </article>
            )}
          </div>

          <div className="section-title-row">
            <div>
              <p className="eyebrow">Celebrations</p>
              <h3>Recent Mount Wins</h3>
            </div>
            <a href="/?view=mounts" className="small-link">Mount Tracker</a>
          </div>
          <div className="card-grid three">
            {recentMountAcquisitions.slice(0, 6).map((acquisition) => (
              <article key={acquisition.id} className="panel">
                <span className="tag success">Mount Win</span>
                <h3>{acquisition.character_name}</h3>
                <p>Collected <strong>{acquisition.mount_name}</strong>.</p>
                <p>{acquisition.source_name || acquisition.set_name || "Mount collection progress"}</p>
                <small>{formatShortDateTime(acquisition.detected_at)}</small>
              </article>
            ))}
            {recentMountAcquisitions.length === 0 ? (
              <article className="panel">
                <span className="tag">Mount Tracker</span>
                <h3>No mount wins recorded yet</h3>
                <p>Recent collection milestones will appear here as the tracker syncs.</p>
              </article>
            ) : null}
          </div>

          <div className="section-title-row">
            <div>
              <p className="eyebrow">Roster Updates</p>
              <h3>Character Name Changes</h3>
            </div>
          </div>
          <div className="card-grid three">
            {announcementRenames.length > 0 ? announcementRenames.map((rename) => (
              <article key={rename.id} className="panel">
                <span className="tag">Name Change</span>
                <h3>{rename.new_name}</h3>
                <p><strong>{rename.old_name}</strong> is now known as <strong>{rename.new_name}</strong>.</p>
                <small>{formatShortDateTime(rename.detected_at)}</small>
              </article>
            )) : (
              <article className="panel">
                <span className="tag">Roster</span>
                <h3>No recent name changes</h3>
                <p>Roster updates are shared here so familiar faces stay easy to recognize.</p>
              </article>
            )}
          </div>
        </section>

        {!canAccessMemberContent ? (
          <section id="events-and-raiding" className="section-block raid-hub" hidden={activeView !== "events"}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">FC Calendar & Raiding</p>
              <h2>Events & Raiding</h2>
              <p>Plan social nights, mount farms, learning runs, and raids together in an organized, low-pressure Free Company environment.</p>
            </div>
            <form action={loginAction}><button className="ghost-button" type="submit">Member Sign In</button></form>
          </div>

          <article className="panel raid-focus-panel">
            <div>
              <span className="tag">Current progression</span>
              <h3>Current raid focus</h3>
              <p>{settings.raidProgressionText}</p>
            </div>
            <div className="raid-focus-action">
              <strong>Want to join a run?</strong>
              <span>Sign in to RSVP and see member planning details.</span>
            </div>
          </article>

          <div className="raid-info-grid">
            <article className="panel">
              <span className="tag">Schedule</span>
              <h3>Plan ahead</h3>
              <p>{settings.raidScheduleText}</p>
            </article>
            <article className="panel">
              <span className="tag">Our approach</span>
              <h3>Progress together</h3>
              <p>{settings.raidExpectationsText}</p>
            </article>
            <article className="panel">
              <span className="tag">Recruitment</span>
              <h3>Find your place</h3>
              <p>{settings.raidRecruitmentText}</p>
            </article>
          </div>

          <div className="section-title-row raid-upcoming-heading">
            <div>
              <p className="eyebrow">Upcoming adventures</p>
              <h3>Upcoming raids and mount farms</h3>
              <p>Published events appear here automatically.</p>
            </div>
          </div>
          <div className="raid-event-grid">
            {publicRaidEvents.length > 0 ? publicRaidEvents.map((event) => (
              <article key={event.id} className="panel raid-event-card">
                <span className="tag">{event.event_type === "mount_farm" ? "Mount farm" : "Raid"}</span>
                <h3>{event.title}</h3>
                <p className="raid-event-time">{formatShortDateTime(event.event_starts_at)}</p>
                {event.duty_name ? <p><strong>Duty:</strong> {event.duty_name}</p> : null}
                {event.mount_name ? <p><strong>Mount target:</strong> {event.mount_name}</p> : null}
                {event.description ? <p>{event.description}</p> : null}
                <span className="raid-event-member-note">Member sign-in is required to RSVP.</span>
              </article>
            )) : (
              <article className="panel raid-empty-card">
                <span className="tag">Schedule</span>
                <h3>New runs are on the horizon</h3>
                <p>Upcoming raids and mount farms will appear here as organizers publish them.</p>
              </article>
            )}
          </div>

          <article className="panel raid-member-planning">
            <div>
              <span className="tag">Member planning</span>
              <h3>RSVP, role preferences, and live party rosters</h3>
              <p>Sign in with your verified Discord account to RSVP, select a preferred role, and view the live party plan.</p>
            </div>
            <form action={loginAction}><button className="button primary" type="submit">Member Sign In</button></form>
	    </article>
		  </section>
        ) : null}
        {canAccessMemberContent && activeView === "crafting" ? (
<section id="crafting" className="section-block" hidden={activeView !== "crafting"}>
  {craftingWorkshopData ? (
    <>
      <div className="section-title-row"><div><p className="eyebrow">FC project board</p><h2>Workshop Projects &amp; Craft Requests</h2><p>Coordinate workshop materials, shared claims, gathering needs, contributions, and member craft requests.</p></div></div>
      <CraftingWorkshopView
    data={craftingWorkshopData}
    actor={{ characterId: eligibleMemberCharacter?.id ?? null, characterName: eligibleMemberCharacter?.character_name ?? null, discordUserId: String(session?.user?.discordUserId ?? "").trim() || null, isOfficer }}
    createProjectAction={createCraftingWorkshopProject}
    createCatalogProjectAction={createCatalogCraftingProject}
    contributeAction={saveCraftingContribution}
    phaseProgressAction={savePreviousCraftingPhaseProgress}
    postDiscordAction={postCraftingProjectToDiscord}
    claimAction={saveCraftingClaim}
    releaseClaimAction={releaseMemberCraftingClaim}
    deleteProjectAction={removeCraftingWorkshopProject}
  />
    </>
  ) : null}
</section>
) : null}
        {canAccessMemberContent && activeView === "calculators" ? (
          <section id="calculators" className="section-block">
            <div className="section-title-row"><div><p className="eyebrow">Member tools</p><h2>Tools &amp; Calculators</h2><p>Plan crafts, identify treasure maps, adjust chocobo colors, optimize squadron missions and submarine builds, and track other long-term goals.</p></div></div>
            <PortalCalculators initial={activeCalculator} />
          </section>
        ) : null}
        <section id="guides" className="section-block" hidden={activeView !== "guides"}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Resources</p>
              <h2>Guides &amp; Resources</h2>
              <p>Helpful starting points for new and returning members.</p>
            </div>
          </div>
          <GuideLibrary selectedSlug={selectedGuideSlug} customResources={guideResources} returnHref={guideReturnHref} />
          {isOfficer ? (
            <details className="tracker-collapsible guide-resource-manager">
              <summary className="tracker-collapsible-summary">
                <div>
                  <span className="tag">Officer tools</span>
                  <h3>Manage Free Company Resources</h3>
                  <p>Add installation-specific notes and external links beneath the built-in guide library.</p>
                </div>
                <span className="tracker-collapsible-toggle">Open</span>
              </summary>
              <div className="officer-tool-content">
                {guideResources.map((guide) => (
                  <details key={guide.id} className="tracker-collapsible guide-resource-editor">
                    <summary className="tracker-collapsible-summary"><div><span className="tag">{guide.category}</span><h4>{guide.title}</h4></div><span className="tracker-collapsible-toggle">Edit</span></summary>
                    <div className="officer-tool-content">
                      <form action={saveGuideResource} className="settings-form">
                        <input type="hidden" name="guideResourceId" value={guide.id} />
                        <div className="form-grid">
                          <label><span>Category</span><input name="guideCategory" defaultValue={guide.category} maxLength={80} /></label>
                          <label><span>Display Order</span><input name="guideSortOrder" type="number" min="0" max="9999" defaultValue={guide.sort_order} /></label>
                          <label><span>Visibility</span><select name="guideVisibility" defaultValue={guide.visibility_mode}><option value="public">Public</option><option value="members">Members only</option></select></label>
                          <label className="full"><span>Title</span><input name="guideTitle" defaultValue={guide.title} maxLength={160} required /></label>
                          <label className="full"><span>Description</span><textarea name="guideBody" defaultValue={guide.body} rows={3} maxLength={1600} required /></label>
                          <label className="full"><span>Optional Link</span><input name="guideUrl" type="url" defaultValue={guide.url || ""} maxLength={500} placeholder="https://..." /></label>
                        </div>
                        <div className="form-actions"><button className="button primary" type="submit">Save Resource</button></div>
                      </form>
                      <form action={archiveGuideResource}><input type="hidden" name="guideResourceId" value={guide.id} /><button className="danger-button" type="submit">Remove Resource</button></form>
                    </div>
                  </details>
                ))}
                <details className="tracker-collapsible guide-resource-editor">
                  <summary className="tracker-collapsible-summary"><div><span className="tag">New resource</span><h4>Add FC note or link</h4></div><span className="tracker-collapsible-toggle">Add</span></summary>
                  <div className="officer-tool-content">
                    <form action={createGuideResource} className="settings-form">
                      <div className="form-grid">
                        <label><span>Category</span><input name="guideCategory" maxLength={80} placeholder="Example: Crafting" /></label>
                        <label><span>Display Order</span><input name="guideSortOrder" type="number" min="0" max="9999" defaultValue={100} /></label>
                        <label><span>Visibility</span><select name="guideVisibility" defaultValue="members"><option value="public">Public</option><option value="members">Members only</option></select></label>
                        <label className="full"><span>Title</span><input name="guideTitle" maxLength={160} required placeholder="What is this resource?" /></label>
                        <label className="full"><span>Description</span><textarea name="guideBody" rows={3} maxLength={1600} required placeholder="Explain why this resource is useful." /></label>
                        <label className="full"><span>Optional Link</span><input name="guideUrl" type="url" maxLength={500} placeholder="https://..." /></label>
                      </div>
                      <div className="form-actions"><button className="button primary" type="submit">Add Resource</button></div>
                    </form>
                  </div>
                </details>
              </div>
            </details>
          ) : null}
        </section>
        <section id="fc-info" className="section-block" hidden={activeView !== "fc-info"}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">About Us</p>
              <h2>FC Information</h2>
              <p>{settings.fcAboutText}</p>
            </div>
          </div>
          <div className="card-grid three">
            {fcInfoCards.map((card) => (
              <article key={card.id} className="panel">
                <span className="tag">{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
          {settings.recruitmentLodestoneUrl || settings.directDiscordContactUrl ? (
            <section className="fc-info-recruitment-panel" aria-label="Recruitment and contact options">
              {fcInfoLead ? (
                <article className="panel fc-info-lead-card">
                  {fcInfoLead.portrait_url ? (
                    <img className="fc-info-lead-portrait" src={fcInfoLead.portrait_url} alt={`${fcInfoLead.character_name} portrait`} />
                  ) : null}
                  <div className="fc-info-lead-copy">
                    <span className="tag">FC Lead</span>
                    <h3>{fcInfoLead.display_name || fcInfoLead.character_name}</h3>
                    <p>{fcInfoLead.character_name} - {fcInfoLead.world}</p>
                    <p className="fc-info-lead-message">Questions before you apply? I am happy to help.</p>
                    {settings.directDiscordContactUrl ? (
                      <a href={settings.directDiscordContactUrl} className="button primary fc-info-lead-contact" target="_blank" rel="noreferrer">
                        Message Me on Discord
                      </a>
                    ) : null}
                  </div>
                </article>
              ) : null}
              {settings.recruitmentLodestoneUrl || (!fcInfoLead && settings.directDiscordContactUrl) ? (
                <div className="fc-info-cta-row" aria-label="Recruitment and contact links">
                  {settings.recruitmentLodestoneUrl ? (
                    <a href={settings.recruitmentLodestoneUrl} className="button primary" target="_blank" rel="noreferrer">
                      Apply Now
                    </a>
                  ) : null}
                  {!fcInfoLead && settings.directDiscordContactUrl ? (
                    <a href={settings.directDiscordContactUrl} className="button primary" target="_blank" rel="noreferrer">
                      Message Me on Discord
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
          {canShowDiscordInvite ? <p className="fc-info-discord-link"><a href={settings.discordInviteUrl} className="small-link" target="_blank" rel="noreferrer">Visit Discord</a></p> : null}

          <article className="panel fc-info-house-card">
            <div>
              <span className="tag">Company Home</span>
              <h3>{settings.fcHouseName}</h3>
              <p>{settings.fcHouseDescription}</p>
            </div>
            <div className="fc-info-house-location">
              <span>Location</span>
              <strong>{settings.fcHouseLocation}</strong>
            </div>
          </article>

          {isOfficer ? (
            <details className="tracker-collapsible fc-info-officer-panel">
              <summary className="tracker-collapsible-summary">
                <div>
                  <span className="tag">Officer tools</span>
                  <h3>Manage FC Information</h3>
                  <p>Edit the public copy, information cards, house details, and gallery without leaving this page.</p>
                </div>
                <span className="tracker-collapsible-toggle">Open</span>
              </summary>
              <div className="officer-tool-content">
                <form action={saveFcInformationSettings} className="settings-form">
                  <div className="form-grid">
                    <label className="full"><span>About the Free Company</span><textarea name="fcAboutText" defaultValue={settings.fcAboutText} rows={3} /></label>
                    <label><span>FC House Name</span><input name="fcHouseName" defaultValue={settings.fcHouseName} maxLength={160} /></label>
                    <label><span>FC House Location</span><input name="fcHouseLocation" defaultValue={settings.fcHouseLocation} maxLength={240} placeholder="Example: Empyreum, Ward 5, Plot 12" /></label>
                    <label className="full"><span>FC House Description</span><textarea name="fcHouseDescription" defaultValue={settings.fcHouseDescription} rows={3} /></label>
                  </div>
                  <div className="form-actions"><button className="button primary" type="submit">Save FC Information</button></div>
                </form>

                <div className="fc-info-card-manager">
                  <div className="section-title-row"><div><span className="tag">Information cards</span><h3>Manage the public cards</h3><p>Change the wording, set their order, add a new card, or remove one that is no longer useful.</p></div></div>
                  {fcInfoCards.map((card) => (
                    <details key={card.id} className="tracker-collapsible fc-info-card-editor">
                      <summary className="tracker-collapsible-summary"><div><span className="tag">{card.label}</span><h4>{card.title}</h4></div><span className="tracker-collapsible-toggle">Edit</span></summary>
                      <div className="officer-tool-content">
                        <form action={saveFcInfoCard} className="settings-form">
                          <input type="hidden" name="fcInfoCardId" value={card.id} />
                          <div className="form-grid">
                            <label><span>Label</span><input name="fcInfoCardLabel" defaultValue={card.label} maxLength={80} /></label>
                            <label><span>Display Order</span><input name="fcInfoCardSortOrder" type="number" min="0" max="9999" defaultValue={card.sort_order} /></label>
                            <label className="full"><span>Title</span><input name="fcInfoCardTitle" defaultValue={card.title} maxLength={160} required /></label>
                            <label className="full"><span>Description</span><textarea name="fcInfoCardBody" defaultValue={card.body} rows={3} maxLength={1600} required /></label>
                          </div>
                          <div className="form-actions"><button className="button primary" type="submit">Save Card</button></div>
                        </form>
                        <form action={archiveFcInfoCard}><input type="hidden" name="fcInfoCardId" value={card.id} /><button className="danger-button" type="submit">Remove Card</button></form>
                      </div>
                    </details>
                  ))}
                  <details className="tracker-collapsible fc-info-card-editor">
                    <summary className="tracker-collapsible-summary"><div><span className="tag">New card</span><h4>Add information card</h4></div><span className="tracker-collapsible-toggle">Add</span></summary>
                    <div className="officer-tool-content">
                      <form action={createFcInfoCard} className="settings-form">
                        <div className="form-grid">
                          <label><span>Label</span><input name="fcInfoCardLabel" maxLength={80} placeholder="Example: New Members" /></label>
                          <label><span>Display Order</span><input name="fcInfoCardSortOrder" type="number" min="0" max="9999" defaultValue={100} /></label>
                          <label className="full"><span>Title</span><input name="fcInfoCardTitle" maxLength={160} required placeholder="What should this card be called?" /></label>
                          <label className="full"><span>Description</span><textarea name="fcInfoCardBody" rows={3} maxLength={1600} required placeholder="Write the information shown on this card." /></label>
                        </div>
                        <div className="form-actions"><button className="button primary" type="submit">Add Card</button></div>
                      </form>
                    </div>
                  </details>
                </div>

                <details className="tracker-collapsible fc-info-gallery-manager">
                  <summary className="tracker-collapsible-summary"><div><span className="tag">FC Gallery</span><h3>Upload and manage photos</h3><p>Add house or FC photos, then edit their captions or remove them.</p></div><span className="tracker-collapsible-toggle">Open</span></summary>
                  <div className="officer-tool-content">
                    <form action={uploadFcGalleryImages} encType="multipart/form-data" className="settings-form">
                      <div className="form-grid">
                        <label><span>Gallery Caption</span><input name="galleryTitle" maxLength={160} placeholder="Example: Our FC House" /></label>
                        <label><span>Photo Description</span><input name="galleryAltText" maxLength={240} placeholder="Brief description for accessibility" /></label>
                        <label className="full"><span>Photos</span><input name="galleryImages" type="file" accept="image/jpeg,image/png,image/webp" multiple required /><small>Upload up to 4 JPG, PNG, or WebP images at a time. Each image can be up to 25 MB. Upload only material you may publish; FFXIV screenshots remain subject to the current Materials Usage Policy.</small></label>
                        <label className="full checkbox-row"><input name="contentRights" type="checkbox" required /><span><strong>I have permission to share these photos.</strong><small>I allow this installation to store and display them as described in the <a href="/legal" target="_blank" rel="noreferrer">content notice</a>.</small></span></label>
                      </div>
                      <div className="form-actions"><button className="button primary" type="submit">Upload Gallery Photos</button></div>
                    </form>
                    {fcGalleryImages.length > 0 ? <div className="stack-list">{fcGalleryImages.map((image) => (
                      <article key={image.id} className="panel compact-row">
                        <div><h4>{image.title}</h4><small>Added {formatShortDateTime(image.created_at)}</small></div>
                        <div className="fc-gallery-officer-actions">
                          <details><summary>Edit photo details</summary><form action={saveFcGalleryImageDetails} className="fc-gallery-edit-form"><input type="hidden" name="galleryImageId" value={image.id} /><label><span>Caption</span><input name="galleryTitle" defaultValue={image.title} maxLength={160} required /></label><label><span>Description</span><input name="galleryAltText" defaultValue={image.alt_text} maxLength={240} placeholder="Brief description for accessibility" /></label><button className="button primary" type="submit">Save Photo Details</button></form></details>
                          <form action={archiveFcGalleryImage}><input type="hidden" name="galleryImageId" value={image.id} /><button className="danger-button" type="submit">Remove Photo</button></form>
                        </div>
                      </article>
                    ))}</div> : <p>No photos have been uploaded yet.</p>}
                  </div>
                </details>
              </div>
            </details>
          ) : null}

          <div className="section-title-row">
            <div>
              <p className="eyebrow">Our Home</p>
              <h3>FC Gallery</h3>
              <p>Photos from our FC house and the places we make memories together.</p>
            </div>
          </div>
          {fcGalleryImages.length > 0 ? <FcGalleryViewer images={fcGalleryImages} /> : (
            <div className="fc-info-gallery-grid">
              <article className="panel">
                <span className="tag">Gallery</span>
                <h3>Photos coming soon</h3>
                <p>Our FC house and community adventures will be shared here.</p>
              </article>
            </div>
          )}</section>
        <section id="gallery" className="section-block" hidden={activeView !== "gallery"}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Community moments</p>
              <h2>Community Gallery</h2>
              <p>Member-shared photos from Discord, reviewed before they are public.</p>
            </div>
          </div>

          <div className="community-gallery-tabs" aria-label="Choose a gallery">
            <a href="/?view=gallery&gallery=gaming_setup" className={activeGalleryCategory === "gaming_setup" ? "active" : ""}>Gaming Setups</a>
            <a href="/?view=gallery&gallery=pet" className={activeGalleryCategory === "pet" ? "active" : ""}>Fur Babies</a>
            <a href="/?view=gallery&gallery=glamour" className={activeGalleryCategory === "glamour" ? "active" : ""}>Glamours</a>
            <a href="/?view=gallery&gallery=artwork" className={activeGalleryCategory === "artwork" ? "active" : ""}>Artwork</a>
          </div>

          {([activeGalleryCategory] as const).map((category) => {
            const isGaming = category === "gaming_setup";
            const isGlamour = category === "glamour";
            const isArtwork = category === "artwork";
            const categoryLabel = isGaming ? "Gaming Setups" : isGlamour ? "Glamours" : isArtwork ? "Artwork" : "Fur Babies";
            const categoryHeading = isGaming ? "What we play on" : isGlamour ? "Glamours from the Free Company" : isArtwork ? "Art shared by the Free Company" : "The pets behind the party";
            const categoryDescription = isGaming
              ? "Member gaming setups shared in Discord."
              : isGlamour
                ? "Member glamour photos shared in Discord."
                : isArtwork
                  ? (isEligibleMember || isOfficer
                    ? "Approved artwork is shared with Free Company members. Artists choose whether each post is also visible publicly."
                    : "Artwork post visibility depends on each artist's public-sharing consent.")
                  : `Fur babies shared by ${installationPortalName}.`;
            const approvedPosts = communityGalleryPosts.filter((post) => post.category === category && post.review_status === "approved");
            const pendingPosts = communityGalleryPosts.filter((post) => post.category === category && post.review_status === "pending");
            const importState = communityGalleryImports.find((request) => request.category === category);
            return (
              <section key={category} className="community-gallery-section">
                <div className="community-gallery-heading">
                  <div>
                    <span className="tag">{categoryLabel}</span>
                    <h3>{categoryHeading}</h3>
                    <p>{categoryDescription}</p>
                  </div>
                </div>
                {approvedPosts.length > 0 ? (
                  <CommunityGalleryBrowser posts={approvedPosts.map((post) => {
                    const displayName = post.display_name_override || post.character_name || post.discord_display_name;
                    return {
                      id: post.id,
                      contributor: displayName,
                      card: (
                        <CommunityGalleryPostCard
                          categoryLabel={isGaming ? "gaming setup" : isGlamour ? "glamour" : isArtwork ? "artwork" : "pet"}
                          displayName={displayName}
                          discordDisplayName={post.discord_display_name}
                          caption={post.caption}
                          postedAt={formatShortDateTime(post.posted_at)}
                          images={post.images.map((image) => ({ id: image.id, src: `/api/community-gallery/${image.id}` }))}
                        >
                          {isOfficer ? (
                            <details className="community-gallery-name-editor">
                              <summary>Edit presented name</summary>
                              <form action={saveCommunityGalleryDisplayName} className="community-gallery-name-form">
                                <input type="hidden" name="postId" value={post.id} />
                                <label>Presented name<input name="displayName" defaultValue={displayName} placeholder="Character or display name" /></label>
                                <button className="button primary" type="submit">Save Name</button>
                              </form>
                            </details>
                          ) : null}
                        </CommunityGalleryPostCard>
                      )
                    };
                  })} />
                ) : (
                  <div className="community-gallery-grid">
                    <article className="panel community-gallery-empty">
                      <h4>No approved posts yet</h4>
                      <p>{isGaming ? "Share a setup in the configured Discord channel to start this gallery." : isGlamour ? "Share a glamour photo in the configured Discord channel to start this gallery." : isArtwork ? (isEligibleMember || isOfficer ? "Approved artwork is shared with Free Company members. Public visibility depends on the artist's consent." : "Artwork appears publicly only when the artist has consented to public visibility.") : "Share a pet photo in the configured Discord channel to start this gallery."}</p>
                    </article>
                  </div>
                )}

                {isOfficer ? (
                  <details className="tracker-collapsible community-gallery-review-panel">
                    <summary className="tracker-collapsible-summary">
                      <div>
                        <span className="tag">Officer review</span>
                        <h4>{pendingPosts.length} pending {isGaming ? "gaming setup" : isGlamour ? "glamour" : isArtwork ? "artwork" : "pet"} post{pendingPosts.length === 1 ? "" : "s"}</h4>
                        <p>Posts stay private until approved. Historical imports are safe to re-run because Discord message and attachment IDs are remembered.</p>
                      </div>
                      <span className="tracker-collapsible-toggle">Open</span>
                    </summary>
                    <div className="community-gallery-review-content">
                      <form action={requestCommunityGalleryImport} className="community-gallery-import-form">
                        <input type="hidden" name="category" value={category} />
                        <div>
                          <strong>Import existing Discord posts</strong>
                          <p className="muted">Scans the configured channel’s history and queues only image posts not seen before.</p>
                          {importState ? <small>Status: {importState.status} · {importState.imported_posts} new posts from {importState.scanned_messages} messages scanned{importState.error_text ? ` · ${importState.error_text}` : ""}</small> : null}
                        </div>
                        <button className="button primary" type="submit" disabled={isGaming ? !discordBotSettings?.gaming_setups_channel_id : isGlamour ? !discordBotSettings?.glamours_gallery_channel_id : isArtwork ? !discordBotSettings?.artwork_gallery_channel_id : !discordBotSettings?.pets_gallery_channel_id}>Import Channel History</button>
                      </form>
                      {pendingPosts.length > 0 ? <div className="community-gallery-review-grid">{pendingPosts.map((post) => (
                        <article key={post.id} className="panel community-gallery-review-card">
                          <div className={`community-gallery-images ${post.images.length > 1 ? "multiple" : ""}`}>{post.images.map((image) => <img key={image.id} src={`/api/community-gallery/${image.id}`} alt="Pending community gallery submission" />)}</div>
                          <h4>{post.display_name_override || post.character_name || post.discord_display_name}</h4>
                          {(post.display_name_override || post.character_name) && (post.display_name_override || post.character_name) !== post.discord_display_name ? <small className="community-gallery-discord-name">Discord: {post.discord_display_name}</small> : null}
                          {isArtwork ? <span className={post.artwork_public_enabled ? "tag success" : "tag warning"}>{post.artwork_public_enabled ? "Artist consented" : "Awaiting artist consent"}</span> : null}
                          {post.caption ? <p>{post.caption}</p> : null}
                          <small>Shared {formatShortDateTime(post.posted_at)}</small>
                          <form action={saveCommunityGalleryDisplayName} className="community-gallery-name-form">
                            <input type="hidden" name="postId" value={post.id} />
                            <label>Presented name<input name="displayName" defaultValue={post.display_name_override || post.character_name || post.discord_display_name} placeholder="Character or display name" /></label>
                            <button className="button primary" type="submit">Save Name</button>
                          </form>
                          <div className="form-actions">
                            <form action={reviewCommunityGalleryPost}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="decision" value="approved" /><button className="button primary" type="submit">Approve</button></form>
                            <form action={reviewCommunityGalleryPost}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="decision" value="rejected" /><button className="danger-button" type="submit">Reject</button></form>
                          </div>
                        </article>
                      ))}</div> : <p className="muted">Nothing is waiting for review.</p>}
                    </div>
                  </details>
                ) : null}
              </section>
            );
          })}
        </section>
        {/* ========================= */}
        {/* SECTION: Dashboard */}
        {/* ========================= */}

        <section id="dashboard" className="dashboard-grid" hidden={activeView !== "home"}>
          <article className="panel wide">
            <span className="tag">System</span>
            <h3>Portal Status</h3>
            <p className={db.ok ? "status ok" : "status bad"}>{db.message}</p>
          </article>

          <article className="panel">
            <span className="tag">Auth</span>
            <h3>Login Status</h3>

            {session?.user ? (
              <>
                <p className="status ok">Authenticated through {installationAuthProviderLabel}.</p>

                <div className="group-list">
                  {userGroups.length > 0 ? (
                    userGroups.map((group) => (
                      <span key={group} className="group-chip">
                        {group}
                      </span>
                    ))
                  ) : (
                    <span className="group-empty">No groups received yet.</span>
                  )}
                </div>
              </>
            ) : (
              <p className="status warn-text">Not signed in yet.</p>
            )}
          </article>

          <article className="panel">
            <span className="tag">Access</span>
            <h3>Role Status</h3>

            {isAdmin ? (
              <p className="status ok">Admin access enabled.</p>
            ) : isOfficer ? (
              <p className="status ok">Officer access enabled.</p>
            ) : canAccessMemberContent ? (
              <p className="status ok">Live FC member access enabled.</p>
            ) : isSignedIn ? (
              <p className="status warn-text">Signed in, but your Discord-linked character is not currently eligible for member access.</p>
            ) : (
              <p className="status warn-text">Public visitor mode.</p>
            )}
          </article>
          {identityShadowStatus ? (
            <article className="panel wide">
              <span className="tag">Identity Bridge</span>
              <h3>Discord sign-in readiness</h3>
              {identityShadowStatus.status === "matched_current" ? (
                <p className="status ok">
                  Shadow match confirmed for <strong>{identityShadowStatus.character_name}</strong>
                  {identityShadowStatus.world ? ` · ${identityShadowStatus.world}` : ""}.
                </p>
              ) : identityShadowStatus.status === "matched_ineligible" ? (
                <p className="status bad">
                  Discord identity matched, but its linked FC character is not currently eligible for member access.
                </p>
              ) : identityShadowStatus.status === "unlinked" ? (
                <p className="status warn-text">
                  Discord identity received, but no verified bot link was found.
                </p>
              ) : identityShadowStatus.status === "unavailable" ? (
                <p className="status warn-text">
                  The private identity check is temporarily unavailable. Current access is unchanged.
                </p>
              ) : (
                <p className="status warn-text">
                  Waiting for Authentik to provide the Discord ID claim. Current access is unchanged.
                </p>
              )}
              <p>
                Shadow mode only: this check does not grant, deny, or change anyone&apos;s portal access.
              </p>
            </article>
          ) : null}
        </section>

        {/* ========================= */}
        {/* SECTION: Quick Links */}
        {/* ========================= */}

        <section id="links" className="section-block" hidden={activeView !== "home" && activeView !== "links"}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Resources</p>
              <h2>Links</h2>
              <p>Useful places to connect with {installationPortalName} and the wider FFXIV community.</p>
            </div>
          </div>

          <div className="link-card-grid">
            {canShowDiscordInvite ? (
              <a href={settings.discordInviteUrl} className="link-card" target="_blank" rel="noreferrer">
                <div className="link-card-image"><img src="https://cdn.simpleicons.org/discord/5865F2" alt="" /></div>
                <div><span className="tag">Community</span><h3>Discord</h3><p>Join the {installationPortalName} community server.</p></div>
              </a>
            ) : null}
            {settings.lodestoneUrl ? (
              <a href={settings.lodestoneUrl} className="link-card" target="_blank" rel="noreferrer">
                <div className="link-card-image"><img src={automaticLinkCardImage(settings.lodestoneUrl)} alt="" /></div>
                <div><span className="tag">Free Company</span><h3>FC Lodestone</h3><p>View our official Lodestone profile.</p></div>
              </a>
            ) : null}
            {settings.communityLinkOneLabel && settings.communityLinkOneUrl ? (
              <a href={settings.communityLinkOneUrl} className="link-card" target="_blank" rel="noreferrer">
                <div className="link-card-image"><img src={automaticLinkCardImage(settings.communityLinkOneUrl)} alt="" /></div>
                <div><span className="tag">Community link</span><h3>{settings.communityLinkOneLabel}</h3><p>Open this community resource.</p></div>
              </a>
            ) : null}
            {settings.communityLinkTwoLabel && settings.communityLinkTwoUrl ? (
              <a href={settings.communityLinkTwoUrl} className="link-card" target="_blank" rel="noreferrer">
                <div className="link-card-image"><img src={automaticLinkCardImage(settings.communityLinkTwoUrl)} alt="" /></div>
                <div><span className="tag">Community link</span><h3>{settings.communityLinkTwoLabel}</h3><p>Open this community resource.</p></div>
              </a>
            ) : null}
            {managedLinkCards.map((link) => (
              <a key={link.id} href={link.url} className="link-card" target="_blank" rel="noreferrer">
                <div className="link-card-image"><img src={link.has_custom_image ? `/api/link-images/${link.id}` : automaticLinkCardImage(link.url)} alt="" /></div>
                <div><span className="tag">Community link</span><h3>{link.label}</h3><p>{link.description || "Open this community resource."}</p></div>
              </a>
            ))}
            <a href="/?view=events" className="link-card link-card-internal">
              <div className="link-card-image link-card-symbol">⚔</div>
              <div><span className="tag">FC calendar</span><h3>Events &amp; Raiding</h3><p>Browse upcoming events, farms, and learning runs.</p></div>
            </a>
            <a href="/?view=mounts" className="link-card link-card-internal">
              <div className="link-card-image link-card-symbol">♞</div>
              <div><span className="tag">Progress</span><h3>Mount Tracker</h3><p>See the Free Company&apos;s mount-farm progress.</p></div>
            </a>
          </div>

          {isOfficer ? (
            <details className="tracker-collapsible officer-link-manager">
              <summary className="tracker-collapsible-summary">
                <div><span className="tag">Officer tools</span><h3>Manage custom links</h3><p>Add, edit, reorder, or remove community resources. Each new link receives its site icon automatically unless you upload your own artwork.</p></div>
                <span className="tracker-collapsible-toggle">Manage Links</span>
              </summary>
              <div className="officer-tool-content">
                <form action={savePortalLinkCard} encType="multipart/form-data" className="settings-form">
                  <div className="form-grid">
                    <label><span>Link Title</span><input name="linkLabel" maxLength={80} required placeholder="Example: The Balance" /></label>
                    <label><span>Link URL</span><input name="linkUrl" type="url" maxLength={500} required placeholder="https://..." /></label>
                    <label><span>Display Order</span><input name="linkSortOrder" type="number" min="0" max="9999" defaultValue="100" /></label>
                    <label><span>Artwork Override (Optional)</span><input name="linkImage" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG, or WebP, up to 4 MB. Upload only artwork you may publish; FFXIV material remains subject to the current Materials Usage Policy.</small></label>
                    <label className="full"><span>Short Description (Optional)</span><input name="linkDescription" maxLength={280} placeholder="Tell members what this link is for." /></label>
                  </div>
                  <div className="form-actions"><button className="button primary" type="submit">Add Link Card</button></div>
                </form>

                {managedLinkCards.length > 0 ? (
                  <div className="stack-list">
                    {managedLinkCards.map((link) => (
                      <article key={link.id} className="panel link-manager-row">
                        <div className="link-manager-preview"><img src={link.has_custom_image ? `/api/link-images/${link.id}` : automaticLinkCardImage(link.url)} alt="" /></div>
                        <form action={savePortalLinkCard} encType="multipart/form-data" className="settings-form">
                          <input type="hidden" name="linkCardId" value={link.id} />
                          <div className="form-grid">
                            <label><span>Link Title</span><input name="linkLabel" maxLength={80} required defaultValue={link.label} /></label>
                            <label><span>Link URL</span><input name="linkUrl" type="url" maxLength={500} required defaultValue={link.url} /></label>
                            <label><span>Display Order</span><input name="linkSortOrder" type="number" min="0" max="9999" defaultValue={link.sort_order} /></label>
                            <label><span>Replace Artwork</span><input name="linkImage" type="file" accept="image/jpeg,image/png,image/webp" /></label>
                            <label className="full"><span>Short Description</span><input name="linkDescription" maxLength={280} defaultValue={link.description || ""} /></label>
                            {link.has_custom_image ? <label className="full"><input name="removeCustomImage" type="checkbox" /> Use the automatic site icon again</label> : null}
                          </div>
                          <div className="form-actions"><button className="button primary" type="submit">Save Link</button></div>
                        </form>
                        <form action={archivePortalLinkCard} className="link-manager-delete"><input type="hidden" name="linkCardId" value={link.id} /><button className="danger-button" type="submit">Remove Link</button></form>
                      </article>
                    ))}
                  </div>
                ) : <p className="muted-copy">No custom link cards have been added yet.</p>}
              </div>
            </details>
          ) : null}
        </section>

{/* ========================= */}
{/* SECTION: Events */}
{/* ========================= */}
{canAccessMemberContent ? (
  <section id="events" className="section-block" hidden={activeView !== "events"}>
    <div className="section-title-row"><div><p className="eyebrow">Member event calendar</p><h2>Upcoming Events and Party Rosters</h2><p>RSVP for upcoming events and share the role you would prefer to play.</p></div></div>
    {!memberEventsData.character ? (
      <article className="panel event-link-warning"><span className="tag warning">Character Link Needed</span><h3>Your portal login is not linked to an active FC character</h3><p>An officer can connect your Authentik email to your character before you RSVP. You can still view the schedule below.</p></article>
    ) : <p className="event-character-note">Signing up as <strong>{memberEventsData.character.character_name}</strong>{` · ${memberEventsData.character.world}`}</p>}
    {memberEventsData.character && personalAttendanceHistory.recorded > 0 ? (
      <article className="event-attendance-history">
        <div><span className="tag">Private Attendance History</span><strong>{personalAttendanceHistory.attended} attended</strong></div>
        <span>{personalAttendanceHistory.late} late</span>
        <span>{personalAttendanceHistory.noShow} no-show</span>
        <small>Only you and officers should use this summary for planning; it is not a public ranking.</small>
      </article>
    ) : null}
    {memberEventsData.character ? <AvailabilityPanel isOfficer={isOfficer} defaultTimeZone={memberPreferences?.eventTimeZone || portalTimeZone} /> : null}
    {memberEventsData.character && discordBotSettings ? <EventPlanningBoard duties={discordDuties} mounts={discordEventMountOptions} timeZone={memberPreferences?.eventTimeZone || portalTimeZone} destinations={eventPlanDestinations} /> : null}
    {memberEventsData.character ? <MemberEventWizard duties={discordDuties} mounts={discordEventMountOptions} isOfficer={isOfficer} eventTimeZone={memberPreferences?.eventTimeZone || portalTimeZone} createEvent={createDiscordEvent} /> : null}
    <div className="member-event-list">
      {memberEventsData.events.length > 0 ? memberEventsData.events.map((event) => {
        const going = event.signups.filter((signup) => signup.signup_status === "going");
        const maybe = event.signups.filter((signup) => signup.signup_status === "maybe");
        const cantAttend = event.signups.filter((signup) => signup.signup_status === "cant_attend");
        const attendanceWindow = getEventAttendanceWindow(event);
        const attendanceStarted = event.check_in_required && Date.now() >= attendanceWindow.startsAt;
        const checkInOpen = isEventCheckInOpen(event);
        const checkedIn = going.filter((signup) => CHECKED_IN_ATTENDANCE_STATUSES.has(signup.attendance_status));
        const late = going.filter((signup) => signup.attendance_status === "late");
        const left = going.filter((signup) => signup.attendance_status === "left");
        const noShow = going.filter((signup) => signup.attendance_status === "no_show");
        const notCheckedIn = going.filter((signup) => signup.attendance_status === "not_checked_in");
        const rosterEligibleGoing = attendanceStarted ? checkedIn : going;
        const goingNeedsMount = rosterEligibleGoing.filter((signup) => signup.needs_target_mount === true);
        const maybeNeedsMount = maybe.filter((signup) => signup.needs_target_mount === true);
        const active = rosterEligibleGoing.filter((signup) => signup.roster_state === "active");
        const waiting = rosterEligibleGoing.filter((signup) => signup.roster_state === "waiting");
        const completed = going.filter((signup) => signup.roster_state === "completed");
        const activePartyNumbers = [...new Set(active.map((signup) => signup.party_number || 1))].sort((a, b) => a - b);
        return (
          <article key={event.id} className="member-event-card">
            {event.duty_image_url || event.mount_image_url ? (
              <div className={`member-event-artwork ${event.duty_image_url ? "has-duty-banner" : "mount-only"}`}>
                {event.duty_image_url ? (
                  <img
                    className="event-duty-banner"
                    src={event.duty_image_url}
                    alt={`${event.duty_name || event.title} duty artwork`}
                  />
                ) : null}
                {event.mount_image_url ? (
                  <img
                    className="event-mount-portrait"
                    src={event.mount_image_url}
                    alt={`${event.mount_name || "Selected mount"} artwork`}
                  />
                ) : null}
              </div>
            ) : null}
            <div className="member-event-heading">
              <div>
                <span className="tag success">{event.event_type.replace("_", " ")}</span>
                {event.status !== "planned" ? <span className="tag">Event Complete</span> : null}
                {checkInOpen ? <span className="tag warning">Check-in Open</span> : null}
                {event.check_in_required ? <span className="tag">Check-in Required</span> : null}
                {event.series_name ? <span className="tag">{event.series_name} #{event.series_occurrence_number}</span> : null}
                <h3>{event.title}</h3><p>{formatShortDateTime(event.event_starts_at)}</p><small>Entered as {getMemberEventTimeZoneLabel(event.event_time_zone)}</small>
                {event.created_by ? <p><strong>Organized by:</strong> {event.created_by}</p> : null}
              </div>
              <div className="member-event-duty">
                <span>{event.event_type === "mount_farm" ? "Mount Target" : "Duty"}</span>
                <strong>
                  {event.event_type === "mount_farm"
                    ? event.mount_name || "To be announced"
                    : event.duty_name || "To be announced"}
                </strong>
                <p>
                  {event.event_type === "mount_farm"
                    ? event.mount_source_name || "No source listed"
                    : event.level
                      ? formatEventLevelRange(event.level, event.level_max)
                      : "No level requirement"}
                </p>
                {event.event_type === "mount_farm" ? (
                  <p>{formatEventLevelRange(event.level, event.level_max)}</p>
                ) : null}
              </div>
            </div>
            {event.description ? <p className="member-event-description">{event.description}</p> : null}
            <div className="event-roster-summary"><span><strong>{going.length}</strong> Going</span><span><strong>{maybe.length}</strong> Maybe</span><span><strong>{cantAttend.length}</strong> Can't Attend</span></div>
            <div className="event-roster-groups">
              <div><h4>Going</h4>{going.length > 0 ? <div className="event-roster-entries">{going.map((signup) => <span key={signup.character_id} className="event-roster-chip">{signup.character_name} - {signup.role_preference.replaceAll("_", " ")}</span>)}</div> : <p>No one yet.</p>}</div>
              <div><h4>Maybe</h4>{maybe.length > 0 ? <div className="event-roster-entries">{maybe.map((signup) => <span key={signup.character_id} className="event-roster-chip maybe">{signup.character_name} - {signup.role_preference.replaceAll("_", " ")}</span>)}</div> : <p>No one yet.</p>}</div>
            </div>

            {event.check_in_required && (checkInOpen || attendanceStarted || event.status !== "planned" || checkedIn.length > 0) ? (
              <section className="event-attendance-panel">
                <div className="event-attendance-heading">
                  <div><span className="tag success">Live Attendance</span><h4>{checkedIn.length} checked in</h4></div>
                  <div className="event-attendance-counts">
                    <span>{Math.max(0, checkedIn.length - late.length)} present</span>
                    <span>{late.length} late</span>
                    <span>{left.length} left</span>
                    {isOfficer ? <span>{noShow.length} no-show</span> : null}
                    <span>{notCheckedIn.length} awaiting check-in</span>
                  </div>
                </div>
                {event.current_signup ? (
                  <div className="event-personal-attendance">
                    <span>Your status: <strong>{getAttendanceLabel(event.current_signup.attendance_status)}</strong></span>
                    {checkInOpen && ["going", "maybe"].includes(event.current_signup.signup_status) && !CHECKED_IN_ATTENDANCE_STATUSES.has(event.current_signup.attendance_status) ? (
                      <form action={checkInToEvent}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <button className="button primary" type="submit">Check In</button>
                      </form>
                    ) : null}
                  </div>
                ) : checkInOpen && memberEventsData.character ? <p>RSVP Going or Maybe before checking in.</p> : null}
                {isOfficer ? (
                  <div className="event-attendance-list">
                    {event.signups.filter((signup) => signup.signup_status !== "cant_attend").map((signup) => (
                      <form key={signup.character_id} className="event-attendance-row" action={updateEventAttendance}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="characterId" value={signup.character_id} />
                        <div><strong>{signup.character_name}</strong><small>{signup.role_preference.replaceAll("_", " ")}</small></div>
                        <select name="attendanceStatus" defaultValue={signup.attendance_status} aria-label={`Attendance status for ${signup.character_name}`}>
                          <option value="not_checked_in">Not checked in</option>
                          <option value="present">Present</option>
                          <option value="late">Late</option>
                          <option value="left">Left</option>
                          <option value="no_show">No-show</option>
                        </select>
                        <button className="event-roster-action" type="submit">Update</button>
                      </form>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="event-party-planning">
              <div className="event-party-planning-heading">
                <div>
                  <span className="tag success">Live Party Roster</span>
                  <h4>{event.party_strategy === "split" ? "Split teams" : "Rotation queue"} - {event.party_size} per party{event.standard_party_roles_required ? "" : " - Flexible composition"}</h4>
                  <p>
                    {going.length} RSVP Going{event.check_in_required ? ` - ${checkedIn.length} checked in` : ""} - {active.length} active - {waiting.length} next up - {completed.length} completed
                    {event.mount_id ? ` - ${goingNeedsMount.length} still need ${event.mount_name}` : ""}
                  </p>
                </div>
                {event.roster_locked ? <span className="tag warning">Roster Locked</span> : null}
              </div>

              {activePartyNumbers.length > 0 ? (
                <div className="event-party-grid">
                  {activePartyNumbers.map((partyNumber) => {
                    const party = active.filter((signup) => (signup.party_number || 1) === partyNumber);
                    return (
                      <div key={partyNumber} className="event-party-card">
                        <div className="event-party-card-heading">
                          <h5>Party {partyNumber} <span>{party.length}/{event.party_size}</span></h5>
                          <small>{event.standard_party_roles_required ? `Needs: ${getPartyRoleNeeds(party, event.party_size)}` : "Flexible composition - standard roles not required"}</small>
                        </div>
                        <div className="event-roster-entries">
                          {party.map((signup) => (
                            <div key={signup.character_id} className="event-participant-row">
                              <span className={`event-roster-chip ${signup.needs_target_mount === true ? "needs-mount" : signup.needs_target_mount === false ? "owns-mount" : ""}`}>
                                {signup.character_name} - {signup.role_preference.replaceAll("_", " ")}
                                {signup.needs_target_mount === true ? " - Needs" : signup.needs_target_mount === false ? " - Has" : ""}
                              </span>
                              {isOfficer ? (
                                <form action={manageEventParticipant}>
                                  <input type="hidden" name="eventId" value={event.id} />
                                  <input type="hidden" name="characterId" value={signup.character_id} />
                                  <input type="hidden" name="rosterAction" value="complete" />
                                  <button className="event-roster-action" type="submit">{event.mount_id ? "Got Mount" : "Complete"}</button>
                                </form>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p>{attendanceStarted ? "No checked-in participants are currently active." : "No active participants yet. The roster builds automatically as members RSVP Going."}</p>}

              <div className="event-roster-state-grid">
                <div className="event-roster-state-card">
                  <h5>Next Up ({waiting.length})</h5>
                  {waiting.length > 0 ? (
                    <div className="event-roster-entries">{waiting.map((signup, index) => (
                      <span key={signup.character_id} className="event-roster-chip waiting">#{index + 1} {signup.character_name} - {signup.role_preference.replaceAll("_", " ")}</span>
                    ))}</div>
                  ) : <p>No overflow waiting.</p>}
                </div>
                <div className="event-roster-state-card">
                  <h5>Completed ({completed.length})</h5>
                  {completed.length > 0 ? (
                    <div className="event-roster-entries">{completed.map((signup) => (
                      <div key={signup.character_id} className="event-participant-row">
                        <span className="event-roster-chip completed">{signup.character_name}{event.mount_id ? " - Mount received" : " - Complete"}</span>
                        {isOfficer ? (
                          <form action={manageEventParticipant}>
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="characterId" value={signup.character_id} />
                            <input type="hidden" name="rosterAction" value="reactivate" />
                            <button className="event-roster-action" type="submit">Return to Roster</button>
                          </form>
                        ) : null}
                      </div>
                    ))}</div>
                  ) : <p>No completions yet.</p>}
                </div>
              </div>

              {event.mount_id && maybeNeedsMount.length > 0 ? (
                <p>{maybeNeedsMount.length} tentative participant{maybeNeedsMount.length === 1 ? "" : "s"} also need this mount.</p>
              ) : null}
              {!event.mount_id && ["custom", "raid", "trial", "dungeon"].includes(event.event_type) && event.mount_suggestions.length > 0 ? (
                <div className="event-mount-suggestions">
                  {event.mount_suggestions.map((suggestion, suggestionIndex) => (
                    <div key={suggestion.mount_id} className="event-mount-suggestion">
                      <strong>{suggestionIndex + 1}. {suggestion.mount_name}</strong>
                      <span>{suggestion.need_count} of {going.length} need</span>
                      <p>{suggestion.source_name || "Source not listed"}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
            {memberEventsData.character && event.status === "planned" && !event.roster_locked ? (
              <form className="event-rsvp-form" action={saveEventSignup}>
                <input type="hidden" name="eventId" value={event.id} />
                <label><span>RSVP</span><select name="signupStatus" defaultValue={event.current_signup?.signup_status || "going"}><option value="going">Going</option><option value="maybe">Maybe</option><option value="cant_attend">Can't Attend</option></select></label>
                <label><span>Preferred Role</span><select name="rolePreference" defaultValue={event.current_signup?.role_preference || memberPreferences?.defaultEventRole || "flexible"}><option value="tank">Tank</option><option value="healer">Healer</option><option value="melee_dps">Melee DPS</option><option value="ranged_dps">Ranged DPS</option><option value="caster">Caster</option><option value="flexible">Flexible</option></select></label><label><span>Secondary Role</span><select name="secondaryRolePreference" defaultValue={event.current_signup?.secondary_role_preference || memberPreferences?.secondaryEventRole || "none"}><option value="none">None</option><option value="tank">Tank</option><option value="healer">Healer</option><option value="melee_dps">Melee DPS</option><option value="ranged_dps">Ranged DPS</option><option value="caster">Caster</option><option value="flexible">Flexible</option></select></label>
                <label className="event-rsvp-notes"><span>Notes</span><input name="notes" maxLength={500} defaultValue={event.current_signup?.notes || ""} placeholder="Optional: late arrival, job choice, etc." /></label>
                <button className="button primary" type="submit">{event.current_signup ? "Update RSVP" : "Save RSVP"}</button>
              </form>
            ) : memberEventsData.character && event.status === "planned" && event.roster_locked ? (
              <p className="event-roster-locked-note">The roster is locked. Ask an officer if your attendance changes.</p>
            ) : event.status !== "planned" ? (
              <p className="event-roster-locked-note">This event is complete. Its RSVP and attendance recap is retained for history.</p>
            ) : null}
            {isOfficer && event.status === "planned" ? (
              <details className="event-edit-panel">
                <summary>
                  <span>Edit Event &amp; Discord Post</span>
                  <small>Update this event card and its original Discord announcement</small>
                </summary>
                <form className="event-edit-form" action={editDiscordEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="eventTimeZone" value={event.event_time_zone} />
                  <input type="hidden" name="dutyId" value={event.duty_id || ""} />
                  <input type="hidden" name="mountId" value={event.mount_id || ""} />
                  <input type="hidden" name="dutyImageUrl" value={event.duty_image_url || ""} />
                  <input type="hidden" name="partyStrategy" value={event.party_strategy} />
                  <input type="hidden" name="partySize" value={event.party_size} />
                  {event.standard_party_roles_required ? <input type="hidden" name="standardPartyRolesRequired" value="on" /> : null}
                  {event.check_in_required ? <input type="hidden" name="checkInRequired" value="on" /> : null}
                  {event.roster_locked ? <input type="hidden" name="rosterLocked" value="on" /> : null}
                  {event.reminder_24h_enabled ? <input type="hidden" name="reminder24Hours" value="on" /> : null}
                  {event.reminder_1h_enabled ? <input type="hidden" name="reminder1Hour" value="on" /> : null}
                  <div className="event-edit-grid">
                    <label><span>Activity Category</span><select name="eventType" defaultValue={event.event_type}>{event.event_type === "mount_farm" ? <option value="mount_farm">Mount Farm</option> : null}<option value="raid">Raids</option><option value="trial">Trials</option><option value="treasure_maps">Maps</option><option value="dungeon">Dungeons</option><option value="custom">Unclassified</option></select></label>
                    <label><span>Minimum Level</span><input name="level" type="number" min="1" max="200" defaultValue={event.level || ""} required /></label>
                    <label><span>Maximum Level</span><input name="levelMax" type="number" min="1" max="200" defaultValue={event.level_max || ""} required /></label>
                    <label><span>Event Date</span><input name="eventDate" type="date" defaultValue={getEventEditDatePart(event.event_starts_at, event.event_time_zone)} required /><small>Processed as {getMemberEventTimeZoneLabel(event.event_time_zone)}</small></label>
                    <label><span>Event Time</span><input name="eventTime" type="time" defaultValue={getEventEditTimePart(event.event_starts_at, event.event_time_zone)} required /></label>
                  </div>
                  <label className="wide-form-field"><span>Title</span><input name="title" defaultValue={event.title} required /></label>
                  <label className="wide-form-field"><span>Description</span><textarea name="description" rows={4} defaultValue={event.description} /></label>
                  {event.roster_locked || new Date(event.event_starts_at).getTime() <= Date.now() ? (
                    <div className="event-edit-warning active">
                      <strong>Restricted edit confirmation</strong>
                      <p>This event is locked or has started. Existing RSVPs will be preserved.</p>
                      <label><input name="confirmRestrictedEdit" type="checkbox" required /> I understand and want to apply this change.</label>
                    </div>
                  ) : null}
                  <div className="discord-settings-actions"><button className="button primary" type="submit">Save &amp; Update Discord Post</button></div>
                </form>
              </details>
            ) : null}
            {isOfficer ? (
              <details className="event-delete-panel">
                <summary>Delete this event</summary>
                <p>This permanently removes the event, its RSVP and roster history, scheduled reminders, and its Discord announcement if one was posted.</p>
                <form action={deleteDiscordEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <label><input type="checkbox" name="confirmDelete" value="yes" required /> I understand this cannot be undone.</label>
                  <button className="danger-button" type="submit">Permanently Delete Event</button>
                </form>
              </details>
            ) : null}
          </article>
        );
      }) : <article className="panel"><span className="tag">No Events</span><h3>No upcoming events are planned</h3><p>New raid nights and mount farms will appear here.</p></article>}
    </div>
  </section>
) : null}
{/* ========================= */}
{/* SECTION: Member Settings */}
{/* ========================= */}

{isEligibleMember && eligibleMemberCharacter ? (
  <section id="settings" className="section-block member-settings-section" hidden={activeView !== "settings"}>
    <div className="section-title-row">
      <div>
        <p className="eyebrow">Member Settings</p>
        <h2>Personal Preferences</h2>
        <p>Personalize the portal for {eligibleMemberCharacter.character_name} · {eligibleMemberCharacter.world}. These choices follow your verified Discord login.</p>
      </div>
    </div>

    <article className="panel member-settings-panel">
      <form action={saveMemberPreferences} className="member-settings-form">
        <details className="member-settings-group" open>
          <summary><span>Notifications and events</span><small>Discord notices and RSVP defaults</small></summary>
          <div className="member-settings-group-body">
            <label className="member-settings-option">
              <span className="member-settings-option-title">Mount-win Discord posts</span>
              <span className="member-settings-option-control"><input type="checkbox" name="mountWinNotificationsEnabled" defaultChecked={memberPreferences?.mountWinNotificationsEnabled ?? true} /><span>Include my tracked farm-target mount wins in congratulations posts</span></span>
            </label>
            <div className="member-settings-option member-settings-select-grid">
              <div><span className="member-settings-option-title">Event reminders</span><small>Choose whether Discord mentions you for every reminder, only the final reminder, or never.</small></div>
              <label><span>Reminder mentions</span><select name="eventReminderLevel" defaultValue={memberPreferences?.eventReminderLevel ?? "all"}><option value="all">All reminders</option><option value="final">Final reminder only</option><option value="none">Do not mention me</option></select></label>
              <label><span>Preferred role</span><select name="defaultEventRole" defaultValue={memberPreferences?.defaultEventRole ?? "flexible"}><option value="tank">Tank</option><option value="healer">Healer</option><option value="melee_dps">Melee DPS</option><option value="ranged_dps">Ranged DPS</option><option value="caster">Caster</option><option value="flexible">Flexible</option></select></label>
              <label><span>Secondary role (optional)</span><select name="secondaryEventRole" defaultValue={memberPreferences?.secondaryEventRole ?? "none"}><option value="none">No secondary role</option><option value="tank">Tank</option><option value="healer">Healer</option><option value="melee_dps">Melee DPS</option><option value="ranged_dps">Ranged DPS</option><option value="caster">Caster</option><option value="flexible">Flexible</option></select></label>
              <label><span>Event creation timezone</span><select name="eventTimeZone" defaultValue={memberPreferences?.eventTimeZone ?? portalTimeZone}>{memberEventTimeZoneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>Times entered while creating events are interpreted in this timezone.</small></label>
            </div>
          </div>
        </details>

        <details className="member-settings-group">
          <summary><span>Navigation and trackers</span><small>Where the portal opens and what collection pages show first</small></summary>
          <div className="member-settings-group-body">
            <div className="member-settings-option member-settings-select-grid">
              <div><span className="member-settings-option-title">Portal start page</span><small>Used only when you open the portal without a specific page link.</small></div>
              <label><span>Default page</span><select name="defaultLandingView" defaultValue={memberPreferences?.defaultLandingView ?? "home"}><option value="home">Home</option><option value="announcements">Announcements</option><option value="polls">Polls</option><option value="events">Events & Raiding</option><option value="crafting">Crafting & Gathering</option><option value="guides">Guides & Resources</option><option value="members">Members</option><option value="mounts">Mounts</option><option value="minions">Minions</option><option value="titles">Titles</option><option value="achievements">Achievements</option><option value="anime">Anime Calendar</option><option value="giveaways">Giveaways & Contests</option><option value="fc-info">FC Information</option><option value="links">Links</option><option value="gallery">Community Gallery</option></select></label>
            </div>
            <div className="member-settings-option member-settings-select-grid">
              <div><span className="member-settings-option-title">Tracker defaults</span><small>Ownership filters still update immediately and can be changed on each page.</small></div>
              <label><span>Mount section</span><select name="defaultMountTab" defaultValue={memberPreferences?.defaultMountTab ?? "collection"}><option value="collection">Mount collection progress</option><option value="marketboard">Marketboard mounts</option></select></label>
              <label><span>Minion section</span><select name="defaultMinionTab" defaultValue={memberPreferences?.defaultMinionTab ?? "collection"}><option value="collection">Minion collection progress</option><option value="marketboard">Marketboard minions</option></select></label>
              <label><span>Minion source</span><select name="defaultMinionCategory" defaultValue={memberPreferences?.defaultMinionCategory ?? ""}><option value="">All acquisition methods</option><option value="farmable">Duty / farmed</option><option value="gathering">Gathering / ventures</option><option value="gardening">Gardening</option><option value="crafting">Crafting / scrips</option><option value="tribal">Tribal quests</option><option value="island_sanctuary">Island Sanctuary</option><option value="pvp">PvP</option><option value="event">Seasonal events</option><option value="quest">Quests</option><option value="vendor">Vendors</option><option value="premium">Premium</option><option value="achievement">Achievements</option><option value="gold_saucer">Gold Saucer</option><option value="other">Other sources</option></select></label>
              <label className="member-settings-option-control"><input type="checkbox" name="hideOwnedMounts" defaultChecked={memberPreferences?.hideOwnedMounts ?? false} /><span>Hide owned mounts by default</span></label>
              <label className="member-settings-option-control"><input type="checkbox" name="hideOwnedMinions" defaultChecked={memberPreferences?.hideOwnedMinions ?? false} /><span>Hide owned minions by default</span></label>
              <label className="member-settings-option-control"><input type="checkbox" name="hideOwnedTitles" defaultChecked={memberPreferences?.hideOwnedTitles ?? false} /><span>Hide owned titles by default</span></label>
              <label className="member-settings-option-control"><input type="checkbox" name="hideOwnedAchievements" defaultChecked={memberPreferences?.hideOwnedAchievements ?? false} /><span>Hide owned achievements by default</span></label>
            </div>
          </div>
        </details>

        <details className="member-settings-group">
          <summary><span>Anime calendar</span><small>Default language, services, view, and clock</small></summary>
          <div className="member-settings-group-body">
            <div className="member-settings-option member-settings-select-grid">
              <div><span className="member-settings-option-title">Release defaults</span><small>Manual choices on the anime page remain remembered in this browser.</small></div>
              <label><span>Language</span><select name="animeLanguage" defaultValue={memberPreferences?.animeLanguage ?? "all"}><option value="all">Sub + Dub</option><option value="sub">SUB</option><option value="dub">DUB</option></select></label>
              <label><span>Opening view</span><select name="animeDefaultView" defaultValue={memberPreferences?.animeDefaultView ?? "upcoming"}><option value="upcoming">Upcoming list</option><option value="calendar">Calendar</option></select></label>
              <label><span>Time zone</span><select name="timeZoneMode" defaultValue={memberPreferences?.timeZoneMode ?? "central"}><option value="central">Central time</option><option value="local">My browser’s local time</option></select></label>
              <label><span>Clock</span><select name="timeFormat" defaultValue={memberPreferences?.timeFormat ?? "12"}><option value="12">12-hour</option><option value="24">24-hour</option></select></label>
            </div>
            <fieldset className="member-settings-option member-settings-check-grid"><legend className="member-settings-option-title">Preferred platforms</legend>{[["crunchyroll","Crunchyroll"],["hidive","HIDIVE"],["oceanveil","OceanVeil"],["netflix","Netflix"],["hulu","Hulu"],["disney","Disney+"],["amazon","Prime Video"]].map(([key,label]) => <label className="member-settings-option-control" key={key}><input type="checkbox" name="animePlatforms" value={key} defaultChecked={memberPreferences?.animePlatforms.includes(key) ?? false} /><span>{label}</span></label>)}</fieldset>
          </div>
        </details>

        <details className="member-settings-group">
          <summary><span>Accessibility and performance</span><small>Readable controls and lighter rendering for older devices</small></summary>
          <div className="member-settings-group-body">
            <div className="member-settings-option member-settings-select-grid">
              <div><span className="member-settings-option-title">Display</span><small>Automatic motion follows your device’s reduced-motion preference.</small></div>
              <label><span>Motion</span><select name="motionPreference" defaultValue={memberPreferences?.motionPreference ?? "automatic"}><option value="automatic">Automatic</option><option value="on">Normal motion</option><option value="off">Reduce motion</option></select></label>
              <label><span>Layout density</span><select name="layoutDensity" defaultValue={memberPreferences?.layoutDensity ?? "comfortable"}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
              <label><span>Text size</span><select name="textScale" defaultValue={memberPreferences?.textScale ?? "standard"}><option value="standard">Standard</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
              <label className="member-settings-option-control"><input type="checkbox" name="highContrastEnabled" defaultChecked={memberPreferences?.highContrastEnabled ?? false} /><span>Higher contrast</span></label>
              <label className="member-settings-option-control"><input type="checkbox" name="dataSaverEnabled" defaultChecked={memberPreferences?.dataSaverEnabled ?? false} /><span>Data saver (hide optional artwork)</span></label>
              <label className="member-settings-option-control"><input type="checkbox" name="cardFlipEnabled" defaultChecked={memberPreferences?.cardFlipEnabled ?? true} /><span>Enable card flip effects</span></label>
            </div>
          </div>
        </details>

        <details className="member-settings-group">
          <summary><span>Artwork consent</span><small>Permission for member artwork to appear publicly</small></summary>
          <div className="member-settings-group-body">
            <label className="member-settings-option">
              <span className="member-settings-option-title">Public artwork permission</span>
              <span className="member-settings-option-control"><input type="checkbox" name="artworkPublicEnabled" defaultChecked={memberPreferences?.artworkPublicEnabled ?? false} /><span>Allow my reviewed artwork submissions to appear in the public gallery</span></span>
              <small>Gaming setups, fur babies, and glamours do not require consent. Artwork still requires officer review after permission is granted.</small>
            </label>
          </div>
        </details>

        <div className="form-actions"><button className="button primary" type="submit">Save Settings</button></div>
	      </form>
	    </article>

    <AvailabilityPanel isOfficer={false} defaultTimeZone={memberPreferences?.eventTimeZone || portalTimeZone} compact />

    <article className="panel member-settings-panel" id="data-privacy">
      <p className="eyebrow">Data &amp; Privacy</p>
      <h3>Control your portal data</h3>
      <p>Download your own records, keep only what is needed for membership verification, or fully opt out. Full opt-out removes the portal-managed Discord roles and nickname, signs you out, and blocks automatic collection until you explicitly opt back in and re-verify.</p>
      <div className="card-actions"><a className="button primary" href="/api/privacy/me/export">Download My Data</a></div>
      <details className="member-settings-group">
        <summary><span>Switch to Verification Only</span><small>Keep member access while deleting optional profile and activity data</small></summary>
        <div className="member-settings-group-body">
          <p>Your Discord-to-character link, current FC status, nickname, and Verified role remain. Collection tracking, portraits, preferences, RSVPs, submissions, and other optional member data are removed and no longer refreshed.</p>
          <form action={minimizeMyPortalData}><label>Type <strong>MINIMIZE</strong> to confirm<input name="confirmation" autoComplete="off" required /></label><button className="button primary" type="submit">Use Verification Only</button></form>
        </div>
      </details>
      <details className="member-settings-group event-delete-panel">
        <summary><span>Delete My Data and Opt Out</span><small>Leave portal verification until you deliberately opt back in</small></summary>
        <div className="member-settings-group-body">
          <p>This removes your link and optional data, clears bot-managed verification and guest roles and your bot-managed nickname, and stores only one-way suppression fingerprints plus a non-identifying compliance receipt. Your Discord server membership and unrelated roles are not changed. The primary portal officer cannot opt out; secondary portal administrators are removed from the portal admin list. Any separately assigned Authentik permissions must also be removed in Authentik.</p>
          <form action={fullyOptOutMyPortalData}><label>Type <strong>DELETE MY PORTAL DATA</strong> to confirm<input name="confirmation" autoComplete="off" required /></label><button className="danger-button" type="submit">Delete My Data and Opt Out</button></form>
        </div>
      </details>
    </article>
	  </section>
) : null}

{/* ========================= */}
{/* SECTION: Members */}
{/* ========================= */}

<section id="members" className="section-block" hidden={activeView !== "members"}>
  <div className="section-title-row">
    <div>
      <p className="eyebrow">Free Company</p>
      <h2>Member Directory</h2>
      <p>Character cards for current {installationPortalName} members and their verified linked characters. Linked characters remain attached to the FC membership character that grants access.</p>
    </div>
  </div>

  <MemberDirectoryView members={memberDirectoryCharacters} roles={roles} initialSearch={memberDirectoryFilters.search} initialRole={memberDirectoryFilters.role} initialSyncStatus={memberDirectoryFilters.syncStatus} />
</section>

        {/* ========================= */}
        {activeView === "polls" && pollPageData ? (
          <PollsView
            dashboard={pollPageData.dashboard}
            actor={{
              discordUserId: String(session?.user?.discordUserId ?? "").trim() || null,
              characterId: pollPageData.eligibility.character?.id ?? null,
              characterName: pollPageData.eligibility.character?.characterName ?? null,
              isOfficer,
              actorLabel: pollPageData.eligibility.character?.characterName || session?.user?.email || session?.user?.name || "Unknown user"
            }}
            channels={discordResourceDiscovery?.channels || []}
            testChannelId={discordBotSettings?.test_channel_id || null}
          />
        ) : null}

        {/* ========================= */}
        {activeView === "giveaways" && giveawayPageData ? (
          <GiveawaysView
            dashboard={giveawayPageData.dashboard}
            actor={{
              discordUserId: String(session?.user?.discordUserId ?? "").trim() || null,
              characterId: giveawayPageData.eligibility.character?.id ?? null,
              characterName: giveawayPageData.eligibility.character?.characterName ?? null,
              isOfficer,
              actorLabel: giveawayPageData.eligibility.character?.characterName || session?.user?.email || session?.user?.name || "Unknown user"
            }}
            sharedTestChannelConfigured={Boolean(discordBotSettings?.test_channel_id)}
            glamourSourceChannelId={discordBotSettings?.glamours_gallery_channel_id || null}
            giveawayChannelConfigured={Boolean(discordBotSettings?.giveaway_channel_id)}
            contestantsChannelConfigured={Boolean(discordBotSettings?.contestants_channel_id)}
          />
        ) : null}
        {activeView === "anime" ? <AnimeReleaseCalendar subCalendarId={process.env.ANIME_GOOGLE_SUB_CALENDAR_ID || ""} dubCalendarId={process.env.ANIME_GOOGLE_DUB_CALENDAR_ID || ""} defaultLanguage={memberPreferences?.animeLanguage || "all"} defaultPlatforms={memberPreferences?.animePlatforms || []} defaultDisplay={memberPreferences?.animeDefaultView || "upcoming"} timeZoneMode={memberPreferences?.timeZoneMode || "central"} timeFormat={memberPreferences?.timeFormat || "12"} /> : null}

        {collectionCatalog && (activeView === "titles" || activeView === "achievements") ? <AchievementTitleTracker kind={activeView} data={collectionCatalog} filters={collectionFilters} characterName={eligibleMemberCharacter?.character_name ?? null} /> : null}

        {activeView === "minions" ? <nav className="collection-tabs" aria-label="Minion tracker sections"><a className={activeMinionTab === "collection" ? "active" : ""} href="/?view=minions&minionTab=collection">Collection Progress</a><a className={activeMinionTab === "marketboard" ? "active" : ""} href="/?view=minions&minionTab=marketboard">Marketboard</a></nav> : null}
        {activeView === "mounts" ? <nav className="collection-tabs" aria-label="Mount tracker sections"><a className={activeMountTab === "collection" ? "active" : ""} href="/?view=mounts&mountTab=collection">Party Tracker</a><a className={activeMountTab === "guide" ? "active" : ""} href="/?view=mounts&mountTab=guide">Collection Progress</a><a className={activeMountTab === "marketboard" ? "active" : ""} href="/?view=mounts&mountTab=marketboard">Marketboard</a></nav> : null}

        {/* SECTION: Mount Tracker */}
        {/* ========================= */}

        {canAccessMemberContent ? (
          <section id="minions" className="mount-preview minion-collection-preview" hidden={activeView !== "minions" || activeMinionTab !== "collection"}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Minion Acquisition Guide</p>
                <h2>Minion Collection Progress</h2>
                <p>Find where and how each minion is acquired, with separate views for duties, gathering, crafting, tribal quests, PvP, events, quests, vendors, premium rewards, and other sources.</p>
                <p className="minion-no-notifications"><strong>Quiet tracking:</strong> minion ownership updates never create Discord notifications.</p>
              </div>
              <a className={`button primary minion-ownership-toggle ${hideOwnedMinions ? "active" : ""}`} href={minionOwnershipToggleHref}>
                {hideOwnedMinions ? "Showing missing minions" : "Hide minions I own"}
              </a>
            </div>

            <div className="stats-row">
              <div className="stat-card"><span>Characters Tracked</span><strong>{minionTrackerStats?.tracked_characters ?? 0}</strong></div>
              <div className="stat-card"><span>Minions Cataloged</span><strong>{minionTrackerStats?.total_minions ?? 0}</strong></div>
              <div className="stat-card"><span>Owned Records</span><strong>{minionTrackerStats?.owned_count ?? 0}</strong></div>
              <div className="stat-card"><span>FC Collection Rate</span><strong>{minionTrackerStats?.collection_rate ?? 0}%</strong></div>
            </div>

            <MinionCollectionBrowser minions={minionAcquisitionCatalog} categories={minionCategoryProgress} allCategoryCount={visibleMinionCategoryCount} activeCategory={activeMinionCategory} activeCategoryName={activeMinionCategory ? getMinionCategoryMetadata(activeMinionCategory).name : "All acquisition methods"} initialSearch={activeMinionSearch} hideOwned={hideOwnedMinions} />
          </section>
        ) : (
          <section id="minions" className="mount-preview" hidden={activeView !== "minions" || activeMinionTab !== "collection"}>
            <div className="section-title-row"><div><p className="eyebrow">Minion Collection</p><h2>Minion Collection Progress</h2><p>Member ownership progress is available after signing in.</p></div></div>
            <a className="button primary" href="/api/auth/signin?callbackUrl=%2F%3Fview%3Dminions%26minionTab%3Dcollection">Member Login</a>
          </section>
        )}

        <section id="marketboard-minions" className="mount-preview marketboard-mount-preview" hidden={activeView !== "minions" || activeMinionTab !== "marketboard"}>
          <div className="section-title-row"><div><p className="eyebrow">Marketboard Minions</p><h2>Lowest minion prices across North America</h2><p>Prices update at the top of every hour. Each card shows the three lowest listings plus your selected {defaultDataCenter}/{defaultWorld} comparison. Minions never generate Discord notifications.</p></div></div>
          {marketboardMinions.length ? <MarketboardMinionGrid minions={marketboardMinions} canFilterByOwnership={Boolean(eligibleMemberCharacter)} comparisonLabel={`${defaultDataCenter}/${defaultWorld}`} comparisonWorld={defaultWorld} defaultHideOwned={memberPreferences?.hideOwnedMinions ?? false} /> : <p className="empty-state">The first minion price scan is still in progress. Please check back shortly.</p>}
        </section>
        {canAccessMemberContent ? (
          <section id="mount-guide" className="mount-preview minion-collection-preview" hidden={activeView !== "mounts" || activeMountTab !== "guide"}>
            <div className="section-title-row"><div><p className="eyebrow">Mount Acquisition Guide</p><h2>Mount Collection Progress</h2><p>Browse every cataloged mount by acquisition method, check ownership, compare marketboard prices, and flip each card to view its artwork.</p></div><a className={`button primary minion-ownership-toggle ${hideOwnedMountGuide ? "active" : ""}`} href={mountOwnershipToggleHref}>{hideOwnedMountGuide ? "Showing missing mounts" : "Hide mounts I own"}</a></div>
            <div className="stats-row"><div className="stat-card"><span>Members Tracked</span><strong>{mountGuideStats?.tracked_characters ?? 0}</strong></div><div className="stat-card"><span>Mounts Cataloged</span><strong>{mountGuideStats?.total_mounts ?? 0}</strong></div><div className="stat-card"><span>Owned Records</span><strong>{mountGuideStats?.owned_count ?? 0}</strong></div><div className="stat-card"><span>FC Collection Rate</span><strong>{mountGuideStats?.collection_rate ?? 0}%</strong></div></div>
            <MountCollectionBrowser mounts={mountAcquisitionCatalog} categories={mountCategoryProgress} allCategoryCount={visibleMountCategoryCount} activeCategory={activeMountCategory} activeCategoryName={activeMountCategory ? getMountCategoryMetadata(activeMountCategory).name : "All acquisition methods"} initialSearch={activeMountSearch} hideOwned={hideOwnedMountGuide} />
          </section>
        ) : (
          <section id="mount-guide" className="mount-preview" hidden={activeView !== "mounts" || activeMountTab !== "guide"}><div className="section-title-row"><div><p className="eyebrow">Mount Collection</p><h2>Mount Collection Progress</h2><p>Sign in to browse all mount sources and use your personal ownership filter.</p></div></div><a className="button primary" href="/api/auth/signin?callbackUrl=%2F%3Fview%3Dmounts%26mountTab%3Dguide">Member Login</a></section>
        )}        <section id="marketboard-mounts" className="mount-preview marketboard-mount-preview" hidden={activeView !== "mounts" || activeMountTab !== "marketboard"}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Marketboard Mounts</p>
                <h2>Lowest price across North America</h2>
                <p>Prices update at the top of every hour. Each card shows the three lowest listings plus your selected {defaultDataCenter}/{defaultWorld} comparison.</p>
              </div>
            </div>
            {marketboardMounts.length ? <MarketboardMountGrid mounts={marketboardMounts} canFilterByOwnership={Boolean(eligibleMemberCharacter)} comparisonLabel={`${defaultDataCenter}/${defaultWorld}`} comparisonWorld={defaultWorld} defaultHideOwned={memberPreferences?.hideOwnedMounts ?? false} /> : <p className="empty-state">The first marketboard price scan is still in progress. Please check back shortly.</p>}
          </section>
        {canAccessMemberContent ? (
          <section id="mounts" className="mount-preview" hidden={activeView !== "mounts" || activeMountTab !== "collection"}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Group Farm Planning</p>
                <h2>Mount Party Tracker</h2>
                <p>
                  Synced mount catalog and character ownership progress from the background worker.
                </p>
              </div>
              {selectedMountSet ? (
                <a className="ghost-button" href={buildMountTrackerHref(null, "mounts")}>
                  View All
                </a>
              ) : (
                <a className="ghost-button" href="/?view=mount-filters">
                  Filters
                </a>
              )}
            </div><div className="stats-row">
              <div className="stat-card">
                <span>Characters Tracked</span>
                <strong>{mountTrackerStats?.tracked_characters ?? characters.length}</strong>
              </div>

              <div className="stat-card">
                <span>Mount Sets</span>
                <strong>{mountSetSummaries.length}</strong>
              </div>

              <div className="stat-card">
                <span>Mounts Synced</span>
                <strong>{mountTrackerStats?.total_mounts ?? totalActiveMounts}</strong>
              </div>

              <div className="stat-card">
                <span>FC Collection Rate</span>
                <strong>{mountTrackerStats?.collection_rate ?? 0}%</strong>
              </div>
            </div>

<details className="tracker-collapsible most-needed-panel" open>
  <summary className="tracker-collapsible-summary">
    <div>
      <p className="eyebrow">Farm Planning</p>
      <h3>Most Needed Mounts</h3>
      <p>
        Mounts with the highest number of tracked characters still missing them.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Expand / Collapse</span>
  </summary>

              <div className="most-needed-grid">
                {mostNeededMounts.length > 0 ? (
                  mostNeededMounts.map((mount) => (
                    <article key={mount.mount_id} className="most-needed-card">
                      <div>
                        <span className="tag">{mount.expansion}</span>
                        <h4>{mount.mount_name}</h4>
                        <p>{mount.source_name || mount.set_name}</p>
                      </div>

                      <div className="most-needed-stats">
                        <strong>{mount.missing_count}</strong>
                        <span>
                          missing · {mount.missing_rate}% of tracked characters
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="panel">
                    <span className="tag">Complete</span>
                    <h3>No missing mounts found</h3>
                    <p>
                      Everyone currently tracked has the mounts in this view.
                    </p>
                  </article>
                )}
              </div>
            </details>

<details
  id="party-planner"
  className="tracker-collapsible party-planner-panel"
  open={selectedPartyCharacterIds.length > 0}
>
  <summary className="tracker-collapsible-summary">
    <div>
      <p className="eyebrow">Party Planning</p>
      <h3>Party Planner</h3>
      <p>
        Pick up to 8 members and calculate the best farm targets for only that group.
      </p>
    </div>

    <span className="party-count-pill">
      {selectedPartyCharacterIds.length > 0
        ? `${selectedPartyCharacterIds.length}/8 selected`
        : "Open Planner"}
    </span>
  </summary>

<PartyPlannerPicker
  partyCharacterOptions={partyCharacterOptions}
  selectedPartyCharacterIds={selectedPartyCharacterIds}
  selectedMountSetId={
    Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
      ? selectedMountSetId
      : null
  }
  initialSearch={partySearch}
/>
              <div className="party-target-grid">
                {selectedPartyCharacterIds.length === 0 ? (
                  <article className="panel">
                    <span className="tag">Waiting</span>
                    <h3>No party selected</h3>
                    <p>
                      Select 4 to 8 members to see the best shared farm targets for that group.
                    </p>
                  </article>
                ) : partyFarmTargets.length > 0 ? (
                  partyFarmTargets.map((target) => (
                    <article key={target.mount_id} className="party-target-card">
                      <div className="party-target-heading">
                        {target.icon_url ? <img className="party-target-mount-image" src={target.icon_url} alt="" /> : null}
                        <div>
                          <span className="tag">{target.expansion}</span>
                          <h4>{target.mount_name}</h4>
                          <p>{target.source_name || target.set_name}</p>
                        </div>

                        <div className="party-target-score">
                          <strong>{target.missing_count}</strong>
                          <span>missing</span>
                        </div>
                      </div>

                      <div className="party-target-columns">
                        <div>
                          <h5>Missing</h5>
                          <div className="mini-chip-list">
                            {target.missing_names.map((name) => (
                              <span key={name} className="mini-chip missing">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h5>Already Has</h5>
                          {target.owned_names.length > 0 ? (
                            <div className="mini-chip-list">
                              {target.owned_names.map((name) => (
                                <span key={name} className="mini-chip collected">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="party-empty-note">Nobody selected has this yet.</p>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="panel">
                    <span className="tag">Complete</span>
                    <h3>No shared missing mounts found</h3>
                    <p>
                      The selected party has everything currently visible in this tracker view.
                    </p>
                  </article>
                )}
              </div>
            </details>

            <div className="mount-set-grid">
              {mountSetProgress.length > 0 ? (
                mountSetProgress.map((mountSet) => (
                  <a
                    key={mountSet.id}
                    className={`mount-set-card mount-set-card-link ${
                      selectedMountSet?.id === mountSet.id ? "selected" : ""
                    }`}
                    href={buildMountTrackerHref(mountSet.id, "mounts")}
                  >
                    <span className="tag">{getMountExpansionFilterLabel(mountSet.expansion)}</span>
                    <h3>{mountSet.name}</h3>

                    <div className="mount-set-progress-line">
                      <strong>{mountSet.collection_rate}%</strong>
                      <span>
                        {mountSet.owned_count}/{mountSet.total_possible} owned
                      </span>
                    </div>

                    <div className="mount-progress-bar" aria-label={`${mountSet.name} progress`}>
                      <span style={{ width: `${Math.min(mountSet.collection_rate, 100)}%` }} />
                    </div>

                    <p>
                      {mountSet.active_mount_count} mount
                      {mountSet.active_mount_count === 1 ? "" : "s"} ·{" "}
                      {mountSet.missing_count} missing across{" "}
                      {mountSet.tracked_characters} character
                      {mountSet.tracked_characters === 1 ? "" : "s"}.
                    </p>
                  </a>
                ))
              ) : (
                <article className="panel">
                  <span className="tag">Waiting</span>
                  <h3>No mount progress yet</h3>
                  <p>
                    Progress will appear here after the worker completes mount catalog and ownership syncs.
                  </p>
                </article>
              )}
            </div>

            <details
              className="tracker-collapsible mount-wins-panel"
            >
              <summary className="tracker-collapsible-summary">
                <div>
                  <p className="eyebrow">Celebrations</p>
                  <h3>Recent Mount Wins</h3>
                  <p>
                    Automatically detected when a tracked member gains a visible farm-target mount.
                  </p>
                </div>

                <span className="tracker-collapsible-toggle">
                  {recentMountAcquisitions.length > 0
                    ? `${recentMountAcquisitions.length} recent`
                    : "Open Wins"}
                </span>
              </summary>

              {isOfficer ? (
                <div className="mount-win-actions">
                  <form action={createTestMountWin}>
                    <button className="ghost-button" type="submit">
                      Create Test Win
                    </button>
                  </form>

                  <form action={clearTestMountWins}>
                    <button className="ghost-button" type="submit">
                      Clear Test Wins
                    </button>
                  </form>
                </div>
              ) : null}

              <div className="mount-wins-list">
                {recentMountAcquisitions.length > 0 ? (
                  recentMountAcquisitions.map((win) => (
                    <article key={win.id} className="mount-win-card">
                      <div>
			<div className="mount-win-tags">
			  <span className="tag">{win.expansion ?? "Mount"}</span>

			  {win.is_test ? (
			    <span className="tag warning">Test</span>
			  ) : null}

			  {win.discord_error === "Cancelled by officer before Discord delivery." ? (
			    <span className="tag warning">Discord Cancelled</span>
			  ) : win.discord_sent_at ? (
			    <span className="tag success">Discord Sent</span>
			  ) : win.discord_error ? (
			    <span className="tag warning">Discord Error</span>
			  ) : (
			    <span className="tag">Discord Pending</span>
			  )}
			</div>
                        <h4>
                          Congratulations {win.character_name} on collecting{" "}
                          {win.mount_name}!
                        </h4>
                        <p>
                          {win.source_name || win.set_name || "Mount acquisition detected"}
                        </p>
			{win.discord_error ? (
			  <p className="mount-win-error">
			    {win.discord_error === "Cancelled by officer before Discord delivery."
			      ? "Notification cancelled before Discord delivery."
			      : `Discord error: ${win.discord_error}`}
			  </p>
			) : null}
                        {isOfficer &&
                        !win.discord_sent_at &&
                        !win.discord_error &&
                        recentMountAcquisitions.find(
                          (candidate) =>
                            candidate.character_id === win.character_id &&
                            !candidate.discord_sent_at &&
                            !candidate.discord_error
                        )?.id === win.id ? (
                          <form action={cancelPendingMountWinNotificationsForCharacter}>
                            <input type="hidden" name="characterId" value={win.character_id} />
                            <button className="danger-button" type="submit">
                              Cancel pending posts for {win.character_name}
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <span className="mount-win-date">
                        {formatShortDateTime(win.detected_at)}
                      </span>
                    </article>
                  ))
                ) : (
                  <article className="panel">
                    <span className="tag">Waiting</span>
                    <h3>No recent mount wins yet</h3>
                    <p>
                      New wins will appear here after the worker detects someone gaining a mount.
                    </p>
                  </article>
                )}
              </div>
            </details>

            {selectedCharacterMountDetails ? (
              <section id="mount-character-details" className="character-mount-detail-panel">
                <div className="character-mount-detail-heading">
                  <div>
                    <p className="eyebrow">Character Mount Details</p>
                    <h3>{selectedCharacterMountDetails.display_name}</h3>
                    <p>
                      {selectedCharacterMountDetails.character_name} ·{" "}
                      {selectedCharacterMountDetails.world} ·{" "}
                      {selectedCharacterMountDetails.role} ·{" "}
                      {selectedCharacterMountDetails.sync_status}
                    </p>
                  </div>

                  <a
                    className="top-action-button"
                    href={buildMountTrackerHref(
                      Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
                        ? selectedMountSetId
                        : null,
                      "mount-character-list"
                    )}
                  >
                    Close Details
                  </a>
                </div>

                <div className="character-mount-set-list">
                  {selectedCharacterMountDetails.sets.map((mountSet) => {
                    const missingMounts = mountSet.mounts.filter((mount) => !mount.owned);
                    const collectedMounts = mountSet.mounts.filter((mount) => mount.owned);

                    return (
                      <details key={mountSet.id} className="character-mount-set" open={missingMounts.length > 0}>
                        <summary>
                          <div>
                            <strong>{mountSet.name}</strong>
                            <span>{mountSet.expansion}</span>
                          </div>

                          <div className="character-mount-set-stats">
                            <span>{mountSet.owned_mounts}/{mountSet.total_mounts}</span>
                            <span>{mountSet.collection_rate}%</span>
                          </div>
                        </summary>

                        <div className="mount-detail-columns">
                          <div>
                            <h4>Missing</h4>

                            {missingMounts.length > 0 ? (
                              <div className="mount-chip-list">
                                {missingMounts.map((mount) => (
                                  <details key={mount.id} className={`mount-card ${mount.owned ? "collected" : "missing"}`}>
  <summary className={`mount-chip ${mount.owned ? "collected" : "missing"}`}>{mount.mount_name}</summary>
  <div className="mount-card-body">{mount.icon_url ? <img src={mount.icon_url} alt="" /> : null}<div><strong>{mount.mount_name}</strong><span>{mount.owned ? "Collected" : "Missing"} · {mount.patch || "Patch unknown"}</span><p>{mount.source_name || "Source details unavailable."}</p></div></div>
</details>
                                ))}
                              </div>
                            ) : (
                              <p className="mount-detail-empty">Nothing missing in this set.</p>
                            )}
                          </div>

                          <div>
                            <h4>Collected</h4>

                            {collectedMounts.length > 0 ? (
                              <div className="mount-chip-list">
                                {collectedMounts.map((mount) => (
                                  <details key={mount.id} className={`mount-card ${mount.owned ? "collected" : "missing"}`}>
  <summary className={`mount-chip ${mount.owned ? "collected" : "missing"}`}>{mount.mount_name}</summary>
  <div className="mount-card-body">{mount.icon_url ? <img src={mount.icon_url} alt="" /> : null}<div><strong>{mount.mount_name}</strong><span>{mount.owned ? "Collected" : "Missing"} · {mount.patch || "Patch unknown"}</span><p>{mount.source_name || "Source details unavailable."}</p></div></div>
</details>
                                ))}
                              </div>
                            ) : (
                              <p className="mount-detail-empty">No collected mounts detected in this set.</p>
                            )}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            ) : null}
			
			 {selectedMountSet ? (
              <div className="active-mount-filter">
                <span>Filtered by mount set</span>
                <strong>{selectedMountSet.name}</strong>
                <a href={buildMountTrackerHref(null, "mounts")}>Clear filter</a>
              </div>
            ) : null}

            <MountCharacterProgressList characters={characterMountProgress} roles={roles} initialSearch={mountTrackerFilters.search} initialRole={mountTrackerFilters.role} initialSyncStatus={mountTrackerFilters.syncStatus} selectedMountSetId={Number.isFinite(selectedMountSetId) && selectedMountSetId > 0 ? selectedMountSetId : null} selectedPartyCharacterIds={selectedPartyCharacterIds} />
          </section>
        ) : (
          <section id="mounts" className="mount-preview" hidden={activeView !== "mounts" || activeMountTab !== "collection"}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Group Farm Planning</p>
                <h2>Mount Party Tracker</h2>
                <p>
                  A public snapshot of {installationPortalName}&apos;s shared mount collection progress.
                </p>
              </div>

              <form action={loginAction}>
                <button className="ghost-button" type="submit">
                  Member Log In
                </button>
              </form>
            </div>

            <div className="stats-row">
              <div className="stat-card">
                <span>Adventurers Tracked</span>
                <strong>{mountTrackerStats?.tracked_characters ?? 0}</strong>
              </div>

              <div className="stat-card">
                <span>Mount Sets</span>
                <strong>{mountSetSummaries.length}</strong>
              </div>

              <div className="stat-card">
                <span>Mounts Synced</span>
                <strong>{mountTrackerStats?.total_mounts ?? totalActiveMounts}</strong>
              </div>

              <div className="stat-card">
                <span>FC Collection Rate</span>
                <strong>{mountTrackerStats?.collection_rate ?? 0}%</strong>
              </div>
            </div>

            <div className="mount-set-grid">
              {mountSetProgress.length > 0 ? (
                mountSetProgress.map((mountSet) => (
                  <article key={mountSet.id} className="mount-set-card">
                    <span className="tag">{getMountExpansionFilterLabel(mountSet.expansion)}</span>
                    <h3>{mountSet.name}</h3>

                    <div className="mount-set-progress-line">
                      <strong>{mountSet.collection_rate}%</strong>
                      <span>{mountSet.owned_count}/{mountSet.total_possible} owned</span>
                    </div>

                    <div className="mount-progress-bar" aria-label={`${mountSet.name} progress`}>
                      <span style={{ width: `${Math.min(mountSet.collection_rate, 100)}%` }} />
                    </div>

                    <p>
                      {mountSet.active_mount_count} mount
                      {mountSet.active_mount_count === 1 ? "" : "s"} · FC-wide progress.
                    </p>
                  </article>
                ))
              ) : (
                <article className="panel">
                  <span className="tag">Waiting</span>
                  <h3>No mount progress yet</h3>
                  <p>Progress will appear here after the worker completes its first mount sync.</p>
                </article>
              )}
            </div>

            <article className="panel">
              <span className="tag">Members Only</span>
              <h3>Explore the full tracker after logging in</h3>
              <p>
                Character search, individual progress, farm planning, recent wins, and detailed mount data are available to verified members.
              </p>
            </article>
          </section>
        )}

        {/* ========================= */}
        {/* SECTION: Officer Area */}
        {/* ========================= */}

        {isOfficer ? (
          <section id="officers" className="section-block" hidden={activeView !== "officers"}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Restricted</p>
                <h2>Officer Area</h2>
                <p>
                  Settings, roles, characters, and sync-ready records are stored in PostgreSQL and can be edited
                  without rebuilding the container.
                </p>
              </div>
            </div>

            <OfficerControlCenter
              fcVerified={fcVerification?.status === "verified"}
              canManageBackups={isAdmin}
              characterCount={characters.length}
              reviewCount={discordRosterReviews.length + discordMemberSnapshotReviews.length}
              pendingActionCount={discordQueueStats.pending + discordQueueStats.needs_confirmation + discordQueueStats.processing}
              failedActionCount={discordQueueStats.failed}
              completedActionCount={discordQueueStats.completed}
              warningCount={collectionSourceWarnings.length}
              failedSyncCount={syncRuns.filter((run) => ["failed", "error"].includes(run.status)).length}
              latestFailedSync={syncRuns.find((run) => ["failed", "error"].includes(run.status))?.sync_type || null}
              upcomingAutomations={[
                ...(discordRosterScanStatus?.next_due_at ? [{ id: "fc-roster-scan", kind: "FC roster", title: "Automatic roster comparison", scheduledAt: discordRosterScanStatus.next_due_at }] : []),
                ...discordScheduledPosts.filter((post) => post.status === "scheduled").map((post) => ({ id: `discord-post-${post.id}`, kind: post.post_type === "event_reminder" ? "Discord event reminder" : post.post_type === "event_announcement" ? "Discord event announcement" : "Discord scheduled post", title: post.title || "Scheduled Discord post", scheduledAt: post.scheduled_for }))
              ].sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()).slice(0, 5)}
              recentChanges={fcRosterAuditChanges.slice(0, 8).map((change) => ({ id: change.id, type: change.change_type, character: change.character_name, world: change.world, detectedAt: change.detected_at, manual: change.scan_source === "manual" }))}
            />

<details id="officer-branding" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div><span className="tag">Appearance</span><h3>Logo and Banner</h3><p>Update public branding without rebuilding the portal.</p></div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>
  <div className="officer-tool-content">
    <PortalBrandingEditor logoUrl={settings.logoUrl} bannerUrl={settings.bannerUrl} save={savePortalBranding} />
  </div>
</details>

<details id="officer-discord-command-administration" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div><span className="tag">Discord</span><h3>Discord Command Administration</h3><p>Choose which member-facing Discord tools are available.</p></div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>
  <div className="officer-tool-content">
    <form action={saveDiscordCommandAdministration} className="settings-form discord-command-admin-form">
      <p>Disabled commands stop accepting new requests and are removed from <code>/{installationDiscordCommandName} help</code>. Changes take effect without rebuilding or restarting the bot.</p>
      <div className="discord-command-admin-grid">
        {discordCommandOptions.map((command) => {
          const required = "required" in command && command.required;
          return (
            <label key={command.name} className={`discord-command-control${required ? " required" : ""}`}>
              <input
                type="checkbox"
                name={required ? undefined : "enabledDiscordCommands"}
                value={command.name}
                defaultChecked={required || !settings.discordDisabledCommands.includes(command.name)}
                disabled={required}
              />
              <span className="discord-command-control-copy">
                <strong><code>/{installationDiscordCommandName} {command.name}</code> · {command.label}</strong>
                <small>{command.description}</small>
              </span>
              {required ? <span className="tag command-required-marker">Cannot be disabled</span> : null}
            </label>
          );
        })}
      </div>
      <div className="form-actions"><button className="button primary" type="submit">Save Discord Commands</button></div>
    </form>
  </div>
</details>

<details id="officer-activity-log" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div><span className="tag">Officer Audit</span><h3>Activity Log</h3><p>Search successful and failed Discord commands alongside roster, event, giveaway, and worker activity.</p></div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>
  <div className="officer-tool-content">
    <OfficerActivityLog {...officerActivityLog} loadActivity={loadOfficerActivityLog} />
  </div>
</details>

<details id="officer-anime-sync" className="tracker-collapsible officer-anime-sync-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className={animeSyncStatus?.available ? (animeSyncStatus.sources.some((source) => source.consecutive_failures > 0 || source.last_error) ? "tag warning" : "tag success") : "tag danger"}>
        {animeSyncStatus?.available ? (animeSyncStatus.sources.some((source) => source.consecutive_failures > 0 || source.last_error) ? "Attention Needed" : "Healthy") : "Unavailable"}
      </span>
      <h3>Anime Calendar Sync</h3>
      <p>Monitor source updates, catalog totals, output readiness, and recent sync results.</p>
    </div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  {!animeSyncStatus?.available ? (
    <article className="anime-sync-unavailable">
      <h4>Anime schedule service is unavailable</h4>
      <p>{animeSyncStatus?.error || "No status was returned."}</p>
      <p>Rebuild or restart the anime schedule service, then reopen this panel.</p>
    </article>
  ) : (
    <div className="anime-sync-dashboard">
      {animeActionMessage ? (
        <article className={animeActionResult === "success" ? "anime-sync-source" : "anime-sync-source issue"}>
          <h4>{animeActionResult === "success" ? "Anime calendar action completed" : "Anime calendar action needs attention"}</h4>
          <p className={animeActionResult === "success" ? undefined : "anime-sync-error"}>{animeActionMessage}</p>
        </article>
      ) : null}

      <details className="anime-sync-source" open={!animeSourceReady || !animeGoogleReady}>
        <summary><strong>Anime source and Google Calendar setup instructions</strong></summary>
        <form action={saveAnimeScheduleToken} className="anime-token-form">
          <label>
            <span>AnimeSchedule application token</span>
            <input name="animeScheduleToken" type="password" autoComplete="off" required placeholder={animeSyncStatus.sourceConfiguration.animeScheduleTokenConfigured ? "Token is configured — enter a replacement to change it" : "Paste the application token"} />
          </label>
          <button className="button primary" type="submit">{animeSyncStatus.sourceConfiguration.animeScheduleTokenConfigured ? "Replace Token" : "Save Token"}</button>
          <small>The token is sent only to the private schedule service and stored in <code>data/anime/anime-schedule-token</code>. It is never displayed again.</small>
        </form>
        <ol>
          <li>Create or sign in to an AnimeSchedule account, open the API section in account settings, create an application, and copy its application token. See the <a href="https://animeschedule.net/api/v3/documentation" target="_blank" rel="noreferrer">AnimeSchedule API documentation</a>.</li>
          <li>Save the token in the field above. As a manual alternative, set <code>ANIME_SCHEDULE_TOKEN='your-token'</code> in the root <code>.env</code> and recreate the schedule container.</li>
          <li>In Google Cloud, enable the Google Calendar API, create a service account, and download its JSON key. Save it on the Docker host as <code>data/anime/google-service-account.json</code>. Never publish this file.</li>
          <li>Create separate SUB and DUB Google calendars. Share each calendar with the service-account email using <strong>Make changes to events</strong>. Copy each ID from <strong>Settings and sharing - Integrate calendar</strong>.</li>
          <li>Add <code>ANIME_GOOGLE_SUB_CALENDAR_ID</code> and <code>ANIME_GOOGLE_DUB_CALENDAR_ID</code> to <code>.env</code>. Keep <code>ANIME_GOOGLE_CREDENTIALS_FILE='/run/anime-secrets/google-service-account.json'</code> and <code>ANIME_GOOGLE_DRY_RUN='true'</code> for the first test.</li>
          <li>Recreate the schedule container after editing <code>.env</code>: <code>docker compose up -d --force-recreate schedule</code>. Return here and test Google Calendars. Once the dry run succeeds, set <code>ANIME_GOOGLE_ENABLED='true'</code>; switch dry run to <code>false</code> only when you are ready for real calendar events.</li>
        </ol>
      </details>

      <div className="anime-sync-stats">
        <article><span>Cataloged Releases</span><strong>{animeSyncStatus.releases.total}</strong><small>{animeSyncStatus.releases.sub} SUB · {animeSyncStatus.releases.dub} DUB</small></article>
        <article><span>Discord Window</span><strong>{animeSyncStatus.releases.upcoming_discord_window}</strong><small>Next {animeSyncStatus.discord.horizonDays} days · {animeSyncStatus.releases.delayed} delayed</small></article>
        <article><span>Last Catalog Update</span><strong>{animeSyncStatus.releases.last_catalog_update ? formatShortDateTime(animeSyncStatus.releases.last_catalog_update) : "Not yet"}</strong><small>{animeSyncStatus.timezone}</small></article>
        <article><span>Next Scheduled Sync</span><strong>{animeSyncStatus.nextScheduledAt ? formatShortDateTime(animeSyncStatus.nextScheduledAt) : `Daily at ${animeSyncStatus.dailySyncTime}`}</strong><small>Automatic daily update</small></article>
      </div>

      <div className="anime-sync-source-grid">
        {animeSyncStatus.sources.length ? animeSyncStatus.sources.map((source) => (
          <article key={source.source_key} className={source.consecutive_failures > 0 || source.last_error ? "anime-sync-source issue" : "anime-sync-source"}>
            <div><span className={source.consecutive_failures > 0 || source.last_error ? "tag danger" : "tag success"}>{source.consecutive_failures > 0 || source.last_error ? "Failed" : "Current"}</span><h4>{source.source_key}</h4></div>
            <p><strong>Last success:</strong> {source.last_success_at ? formatShortDateTime(source.last_success_at) : "Never"}</p>
            <p><strong>Records:</strong> {source.last_result_count}</p>
            {source.next_retry_at ? <p><strong>Next retry:</strong> {formatShortDateTime(source.next_retry_at)}</p> : null}
            {source.last_error ? <p className="anime-sync-error">{source.last_error}</p> : null}
          </article>
        )) : <article className="anime-sync-source issue"><h4>No source state recorded</h4><p>Run the first applied sync to initialize source health.</p></article>}
      </div>

      <div className="anime-output-status-grid">
        <article>
          <span className={animeDiscordSchedulingEnabled ? "tag success" : "tag warning"}>Discord {animeDiscordSchedulingEnabled ? "Enabled" : "Disabled"}</span>
          <h4>Discord Scheduled Events</h4>
          <p>{animeSyncStatus.discord.languages.map((language) => language.toUpperCase()).join(" + ")} · next {animeSyncStatus.discord.horizonDays} days</p>
          <p>{animeSyncStatus.outputs.filter((output) => output.output_kind === "discord").reduce((total, output) => total + output.mapped, 0)} mapped events</p>
        </article>
        <article>
          <span className={animeSyncStatus.google.enabled ? "tag success" : "tag warning"}>Google {animeSyncStatus.google.enabled ? (animeSyncStatus.google.dryRun ? "Dry Run" : "Enabled") : "Disabled"}</span>
          <h4>Google Calendars</h4>
          <p>SUB: {animeSyncStatus.google.calendars?.sub?.configured ? "Ready" : "Calendar ID needed"} · {animeSyncStatus.outputs.find((output) => output.output_kind === "google" && output.output_language === "sub")?.mapped || 0} mapped</p>
          <p>DUB: {animeSyncStatus.google.calendars?.dub?.configured ? "Ready" : "Calendar ID needed"} · {animeSyncStatus.outputs.find((output) => output.output_kind === "google" && output.output_language === "dub")?.mapped || 0} mapped</p>
          <form action={testAnimeGoogleCalendars}><button className="button primary" type="submit" disabled={!animeGoogleReady}>Test Google Calendars</button></form>
          {!animeGoogleReady ? <small>Add the required calendar IDs and service-account JSON, then recreate the schedule container.</small> : null}
        </article>
      </div>

      <div className="anime-sync-actions">
        <div>
          <h4>Manual Update</h4>
          <p>Fetch and apply all configured sources in the background. You can leave this page while it runs.</p>
          {animeSyncStatus.backgroundSync.status === "running" ? <p className="anime-sync-running"><strong>Sync is running.</strong> Refresh this page to check its progress.</p> : null}
          {animeSyncStatus.backgroundSync.status === "success" && animeSyncStatus.backgroundSync.completedAt ? <p><strong>Last manual sync completed:</strong> {formatShortDateTime(animeSyncStatus.backgroundSync.completedAt)}</p> : null}
          {animeSyncStatus.backgroundSync.status === "skipped" ? <p><strong>Last request was skipped:</strong> {animeSyncStatus.backgroundSync.error || "Another sync was already running."}</p> : null}
          {animeSyncStatus.backgroundSync.status === "failed" ? <p className="anime-sync-error"><strong>Last manual sync failed:</strong> {animeSyncStatus.backgroundSync.error || "Unknown error"}</p> : null}
        </div>
        <form action={runAnimeScheduleSync}><button className="button primary" type="submit" disabled={!animeSourceReady || animeSyncStatus.backgroundSync.status === "running"}>{animeSyncStatus.backgroundSync.status === "running" ? "Sync Running…" : "Run Anime Sync Now"}</button>{!animeSourceReady ? <small>Configure an AnimeSchedule application token first.</small> : null}</form>
      </div>

      <div className="anime-sync-runs">
        <h4>Recent Sync Runs</h4>
        {animeSyncStatus.recentRuns.length ? animeSyncStatus.recentRuns.map((run) => (
          <article key={run.id}>
            <span className={run.status === "success" ? "tag success" : run.status === "failed" ? "tag danger" : "tag warning"}>{run.status}</span>
            <strong>{run.source_key || "All sources"}</strong>
            <span>{run.run_kind}{run.dry_run ? " · dry run" : " · applied"}</span>
            <time>{formatShortDateTime(run.started_at)}</time>
            {run.run_kind === "output" && formatAnimeOutputRunSummary(run.summary) ? <small className="anime-sync-run-summary">{formatAnimeOutputRunSummary(run.summary)}</small> : null}
            {run.error_text ? <p className="anime-sync-error">{run.error_text}</p> : null}
          </article>
        )) : <p>No sync history has been recorded yet.</p>}
      </div>
    </div>
  )}
</details>
<details id="officer-join-dates" className="tracker-collapsible officer-join-date-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Officer Tool</span>
      <h3>Join Date Manager</h3>
      <p>
        Set known FC join dates. If left blank, member cards show the first time
        the portal saw that character in the synced roster.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <div className="join-date-manager-list">
    {joinDateCharacters.map((character) => {
      const visibleJoinDate =
        character.join_date_override || character.first_seen_in_fc_at;

      const joinLabel = character.join_date_override
        ? "Manual join date"
        : character.first_seen_in_fc_at
          ? "Tracked since"
          : "Unknown";

      return (
        <article key={character.id} className="join-date-manager-card">
          <div>
            <h4>{character.display_name}</h4>
            <p>
              {character.character_name} · {character.world} · {character.role}
            </p>
          </div>

          <div className="join-date-current">
            <span>{joinLabel}</span>
            <strong>{formatShortDate(visibleJoinDate)}</strong>
          </div>

          <form className="join-date-form" action={updateCharacterJoinDate}>
            <input type="hidden" name="characterId" value={character.id} />

            <label>
              <span>Known Join Date</span>
              <input
                type="date"
                name="joinDate"
                defaultValue={
                  character.join_date_override
                    ? String(character.join_date_override).slice(0, 10)
                    : ""
                }
              />
            </label>

            <button className="button primary" type="submit">
              Save
            </button>
          </form>

          {character.join_date_override ? (
            <form action={updateCharacterJoinDate}>
              <input type="hidden" name="characterId" value={character.id} />
              <input type="hidden" name="clearJoinDate" value="true" />

              <button className="ghost-button" type="submit">
                Clear Manual Date
              </button>
            </form>
          ) : null}
        </article>
      );
    })}
  </div>
</details>

<details id="officer-discord-automation" className="tracker-collapsible discord-automation-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Discord Bot</span>
      <h3>Discord Automation</h3>
      <p>
        Review verified Discord links, /iam attempts, pending matches, and bot automation activity.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <div className="discord-automation-grid">
    <article className="discord-automation-card">
      <div className="section-title-row compact">
        <div>
          <p className="eyebrow">Linked Members</p>
          <h3>Verified Discord Links</h3>
          <p>
            Showing the latest {discordLinks.length} Discord-to-character links.
          </p>
        </div>
      </div>

      <article className="discord-link-reassign-panel">
        <div><span className="tag warning">Officer correction</span><h4>Reassign a verified Discord member</h4><p>Move an existing verified Discord identity to a different active, current FC character. The Discord identity stays the same, and the correction is retained in the audit log.</p></div>
        <DiscordLinkAssignmentForm
          action={reassignVerifiedDiscordLink}
          mode="reassign"
          discordOptions={discordLinks.map((link) => {
            const name = link.discord_display_name || link.discord_nickname || link.discord_global_name || link.discord_username || link.discord_user_id;
            return { value: link.discord_user_id, label: `${name} — currently ${link.character_name || "unlinked"}` };
          })}
          characterOptions={characters
            .filter((character) => character.active && character.fc_membership_status === "current")
            .map((character) => ({ value: String(character.id), label: `${character.character_name} · ${character.world}` }))}
        />
      </article>
      <div className="discord-link-list">
        {discordLinks.length > 0 ? (
          discordLinks.map((link) => {
            const discordName =
              link.discord_display_name ||
              link.discord_nickname ||
              link.discord_global_name ||
              link.discord_username ||
              link.discord_user_id;

            return (
              <article key={link.discord_user_id} className="discord-link-row">
                <div>
                  <h4>{discordName}</h4>
                  <p>
                    Discord ID: <span>{link.discord_user_id}</span>
                  </p>
                </div>

                <div>
                  <span className="tag success">Linked</span>
                  <strong>
                    {link.character_name
                      ? `${link.character_name}${link.world ? ` · ${link.world}` : ""}`
                      : "No character"}
                  </strong>
                  <p>{link.role || "No role"}</p>
                </div>

                <div>
                  <span>Source</span>
                  <strong>{link.match_source}</strong>
                </div>

                <div>
                  <span>Last Seen</span>
                  <strong>{formatShortDateTime(link.last_seen_at)}</strong>
                </div>
              </article>
            );
          })
        ) : (
          <article className="panel">
            <span className="tag">No Links</span>
            <h3>No Discord links yet</h3>
            <p>Use /iam in Discord to create the first verified link.</p>
          </article>
        )}
      </div>
    </article>

    <article className="discord-automation-card">
      <div className="section-title-row compact">
        <div>
          <p className="eyebrow">Audit Log</p>
          <h3>Recent Discord Bot Activity</h3>
          <p>
            Matched, pending, denied, and failed automation attempts.
          </p>
        </div>
      </div>

      <div className="discord-audit-list">
        {discordAuditLogs.length > 0 ? (
          discordAuditLogs.map((log) => {
            const discordName =
              log.discord_display_name ||
              log.discord_nickname ||
              log.discord_global_name ||
              log.discord_username ||
              log.discord_user_id ||
              "Unknown Discord user";

            const resultClass =
              log.result === "matched"
                ? "success"
                : log.result === "pending"
                  ? "warning"
                  : "danger";

            return (
              <article key={log.id} className="discord-audit-row">
                <div>
                  <span className={`tag ${resultClass}`}>{log.result}</span>
                  <h4>{discordName}</h4>
                  <p>{formatShortDateTime(log.created_at)}</p>
                </div>

                <dl>
                  <div>
                    <dt>Attempt</dt>
                    <dd>{log.attempt_type}</dd>
                  </div>

                  <div>
                    <dt>Submitted</dt>
                    <dd>{log.submitted_character_name || "None"}</dd>
                  </div>

                  <div>
                    <dt>Matched Character</dt>
                    <dd>{log.character_name || "None"}</dd>
                  </div>

                  <div>
                    <dt>Reason</dt>
                    <dd>{log.reason || "No reason recorded"}</dd>
                  </div>
                </dl>
              </article>
            );
          })
        ) : (
          <article className="panel">
            <span className="tag">No Activity</span>
            <h3>No Discord audit logs yet</h3>
            <p>Bot activity will appear here after /iam or auto-match attempts.</p>
          </article>
        )}
      </div>
    </article>
  </div>
</details>

<details id="officer-character-rename-review" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag warning">Name Changes</span>
      <h3>Character Rename Review</h3>
      <p>Review recent character renames and any Discord nickname responses.</p>
    </div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <div className="officer-tool-content">
    {characterRenameReviews.length > 0 ? (
      <div className="character-rename-review-list">
        {characterRenameReviews.map((rename) => (
          <article key={rename.id} className="character-rename-review-row">
            {rename.portrait_url ? (
              <img src={rename.portrait_url} alt={`${rename.new_name} portrait`} />
            ) : (
              <span className="tag">Portrait unavailable</span>
            )}
            <div>
              <h4>{rename.display_name || rename.new_name}</h4>
              <p><strong>{rename.old_name}</strong> → <strong>{rename.new_name}</strong></p>
              <small>Detected {formatShortDateTime(rename.detected_at)} · Notification {rename.notification_status}</small>
            </div>
            <span className={rename.confirmation_status === "disputed" ? "tag danger" : "tag warning"}>
              {rename.confirmation_status.replaceAll("_", " ")}
            </span>
          </article>
        ))}
      </div>
    ) : (
      <article className="panel">
        <span className="tag success">Clear</span>
        <h3>No character renames recorded</h3>
        <p>New roster-detected changes will appear here and remain on member cards as permanent history.</p>
      </article>
    )}
  </div>
</details>
<details id="officer-test-mount-win" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Test Channel</span>
      <h3>Test Mount Win Post</h3>
      <p>Create a bot-formatted mount-win post in the Test Channel without changing ownership records.</p>
    </div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <div className="officer-tool-content">
    <form action={queueTestMountWin} className="settings-form">
      <div className="form-grid">
        <label>
          <span>Mount</span>
          <select name="mountWinTestMountId" required defaultValue="">
            <option value="" disabled>Select a mount</option>
            {mountWinTestOptions.map((mount) => (
              <option key={mount.id} value={mount.id}>
                {mount.mount_name}{mount.expansion ? ` — ${mount.expansion}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="full">
          <span>Character Names</span>
          <textarea
            name="mountWinTestWinnerNames"
            rows={4}
            required
            placeholder={"One character name per line\nSecond character name"}
          />
        </label>
      </div>
      <p className="muted">This only posts to the configured Test Channel. It does not create mount ownership or contact real members.</p>
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={!discordBotSettings?.test_channel_id}>
          Send Test Mount Win
        </button>
      </div>
    </form>
  </div>
</details>
<details id="officer-alt-character-claims" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div><span className="tag">Linked Characters</span><h3>Alt Character Claims &amp; Verification</h3><p>Control private self-service claims, verification rules, and per-member limits. Initial FC verification is unchanged.</p></div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>
  {discordBotSettings ? <div className="officer-tool-content">
    <form action={updateAltCharacterSettings} className="settings-form">
      <div className="form-grid">
        <label className="full"><span className="checkbox-row"><input type="checkbox" name="altCharacterClaimsEnabled" defaultChecked={discordBotSettings.alt_character_claims_enabled}/><span><strong>Enable additional-character claims</strong><small>Disabled by default. Turning this off blocks new claims but keeps existing verified links and scans.</small></span></span></label>
        <label><span>Default additional characters per member</span><input type="number" name="altCharacterDefaultLimit" min={0} max={32} defaultValue={discordBotSettings.alt_character_default_limit}/><small>The FC membership anchor does not count toward this limit. Default: 1.</small></label>
        <label><span>Verification policy</span><select name="altCharacterVerificationMode" defaultValue={discordBotSettings.alt_character_verification_mode}><option value="code_or_officer">Profile code or officer approval</option><option value="officer_only">Officer approval only</option></select></label>
        <label><span>Profile-code expiry (minutes)</span><input type="number" name="altCharacterCodeExpiryMinutes" min={10} max={1440} defaultValue={discordBotSettings.alt_character_code_expiry_minutes}/><small>Codes are one-time, request-specific, and matched without case sensitivity.</small></label>
      </div>
      <div className="form-actions"><button className="button primary" type="submit">Save Alt Character Settings</button></div>
    </form>
    <div className="panel"><span className="tag">Officer Override</span><h4>Bind an existing character</h4><p>Use the Character Manager to add or confirm the Lodestone record first, then bind it here. This is permanently audited as officer-bound and still requires a current FC membership anchor.</p><form action={bindAltCharacterAsOfficer} className="form-grid"><label><span>Discord member</span><select name="discordUserId" required defaultValue=""><option value="" disabled>Choose a member</option>{altCharacterMembers.map((member)=><option value={member.discord_user_id} key={member.discord_user_id}>{member.discord_name} · {member.anchor_name}</option>)}</select></label><label><span>Character</span><select name="characterId" required defaultValue=""><option value="" disabled>Choose a Lodestone character</option>{characters.filter((character)=>Boolean(character.lodestone_character_id)).map((character)=><option value={character.id} key={character.id}>{character.character_name} · {character.world} · {character.fc_membership_status}</option>)}</select></label><div className="form-actions"><button className="button primary" type="submit">Bind Character</button></div></form></div>
    <div className="panel"><span className="tag">Member Limits</span><h4>Linked and pending characters</h4><p>Leave a custom limit blank to use the global default.</p>
      <div className="character-list compact">
        {altCharacterMembers.map((member)=><article className="character-card" key={member.discord_user_id}>
          <div className="character-summary"><div><h4>{member.discord_name}</h4><p>{member.anchor_name} · Discord {member.discord_user_id}</p></div><div className="character-meta"><span>{member.active_alts} linked</span><span>{member.pending_claims} pending</span><span>Limit {member.effective_limit}</span></div></div>
          {member.linked_characters.length > 0 || member.pending_characters.length > 0 ? <details className="tracker-collapsible"><summary className="tracker-collapsible-summary"><div><strong>View linked characters and verification history</strong><p>Shows whether each character used an officer decision or Lodestone profile code.</p></div><span className="tracker-collapsible-toggle">Open</span></summary><div className="officer-tool-content">
            {member.linked_characters.map((linked)=><article className="panel" key={`linked-${linked.id}`}><div className="character-summary"><div><h4>{linked.character_name}</h4><p>{linked.world} · linked {formatShortDateTime(linked.verified_at)}</p></div><div className="character-meta"><span>{altVerificationLabel(linked.verification_method)}</span>{linked.verified_by_discord_user_id&&linked.verification_method!=="self_service_profile_code"?<span>Officer Discord {linked.verified_by_discord_user_id}</span>:null}</div></div></article>)}
            {member.pending_characters.map((claim)=><article className="panel" key={`pending-${claim.id}`}><div className="character-summary"><div><h4>{claim.character_name}</h4><p>{claim.world} · requested {formatShortDateTime(claim.created_at)}</p></div><div className="character-meta"><span>{claim.status==="code_required"?"Profile code required":"Awaiting approval or profile code"}</span></div></div></article>)}
          </div></details>:null}
          <form action={updateAltCharacterLimit} className="form-grid"><input type="hidden" name="discordUserId" value={member.discord_user_id}/><label><span>Custom maximum</span><input type="number" name="maxAdditionalCharacters" min={0} max={32} defaultValue={member.custom_limit ?? ""} placeholder={`Use default (${discordBotSettings.alt_character_default_limit})`}/></label><div className="form-actions"><button className="button" type="submit">Save / Reset Limit</button></div></form>
        </article>)}
      </div>
    </div>
  </div>:null}
</details>

<details id="officer-discord-bot-settings" className="tracker-collapsible discord-bot-settings-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Discord Bot</span>
      <h3>Discord Bot Settings</h3>
      <p>
        Configure the live server, verification roles, bot logs, production channels, and an isolated test channel.
        The bot token stays private in the .env file.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  {discordBotSettings ? (
    <>
      <div className="panel discord-discovery-status">
        {discordResourceDiscovery?.error ? (
          <>
            <span className="tag warning">Discord discovery unavailable</span>
            <p>{discordResourceDiscovery.error}</p>
            <p className="muted">Previously saved selections remain available and will not be replaced automatically.</p>
          </>
        ) : (
          <>
            <span className="tag success">Connected to Discord</span>
            <h4>{discordResourceDiscovery?.guildName || "Configured server"}</h4>
            <p>{discordResourceDiscovery?.roles.length || 0} assignable roles and {discordResourceDiscovery?.channels.length || 0} writable text channels found.</p>
            {discordResourceDiscovery?.warnings.map((warning) => <p className="muted" key={warning}>{warning}</p>)}
          </>
        )}
        <a className="small-link" href="/?view=officers&refreshDiscord=1#officer-discord-bot-settings">Refresh roles and channels</a>
      </div>
    <form className="discord-bot-settings-form" action={updateDiscordBotSettings}>
      <div className="discord-settings-grid">
        <label>
          <span>Connected Discord Server</span>
          <input
            name="guildId"
            value={discordBotSettings.guild_id}
            readOnly
          />
          <small>The server is selected during first-time setup.</small>
        </label>

        <label>
          <span>Verified Member Role</span>
          <DiscordResourceSelect
            name="verifiedRoleId"
            currentValue={discordBotSettings.verified_role_id}
            emptyLabel="Do not assign a verified role"
            options={discordResourceDiscovery?.roles || []}
          />
        </label>

        <label>
          <span>Unverified Member Role</span>
          <DiscordResourceSelect
            name="unverifiedRoleId"
            currentValue={discordBotSettings.unverified_role_id}
            emptyLabel="No unverified role"
            options={discordResourceDiscovery?.roles || []}
          />
        </label>

        <label>
          <span>Temporary Guest Access</span>
          <span className="checkbox-row">
            <input
              type="checkbox"
              name="temporaryGuestsEnabled"
              defaultChecked={discordBotSettings.temporary_guest_enabled}
            />
            <span>
              <strong>Allow temporary guests</strong>
              <small>Shows the guest option during onboarding and enforces timed removal.</small>
            </span>
          </span>
        </label>

        <label>
          <span>Temporary Guest Role</span>
          <DiscordResourceSelect
            name="tempAccessRoleId"
            currentValue={discordBotSettings.temp_access_role_id}
            emptyLabel="No temporary guest role"
            options={discordResourceDiscovery?.roles || []}
          />
        </label>

        <label>
          <span>New Member Choice Window (minutes)</span>
          <input
            type="number"
            name="onboardingSelectionMinutes"
            min={1}
            max={1440}
            defaultValue={discordBotSettings.onboarding_selection_minutes}
          />
        </label>

        <label>
          <span>Temporary Guest Access (hours)</span>
          <input
            type="number"
            name="tempGuestHours"
            min={1}
            max={720}
            defaultValue={discordBotSettings.temp_guest_hours}
          />
          <small>Used only when temporary guest access is enabled. Maximum 720 hours.</small>
        </label>

        <label>
          <span>Welcome / Verification Channel</span>
          <DiscordResourceSelect
            name="welcomeChannelId"
            currentValue={discordBotSettings.welcome_channel_id}
            emptyLabel="No welcome channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Free Company Chat Channel</span>
          <DiscordResourceSelect
            name="freeCompanyChatChannelId"
            currentValue={discordBotSettings.free_company_chat_channel_id}
            emptyLabel="No FC chat greeting channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span className="setup-field-label">
            Portal Welcome Engagement
            <span className="setup-help-tip" role="button" tabIndex={0} aria-label="Help: Controls the portal bot post-verification greeting in the Free Company chat channel, including its Wave hello button and optional stickers. Leave this off when your server prefers Discord built-in welcome engagement. Verification and onboarding continue to work either way.">
              <span className="setup-help-icon" aria-hidden="true">?</span>
              <span className="setup-help-text" aria-hidden="true">Controls the portal bot&apos;s post-verification greeting in the Free Company chat channel, including its <strong>Wave hello</strong> button and optional stickers. Leave this off when your server prefers Discord&apos;s built-in welcome engagement. Verification and onboarding continue to work either way.</span>
            </span>
          </span>
          <span className="checkbox-row">
            <input
              type="checkbox"
              name="welcomeEngagementEnabled"
              defaultChecked={discordBotSettings.welcome_engagement_enabled}
            />
            <span>
              <strong>Post the portal greeting and Wave hello button</strong>
              <small>Optional; disabled by default for new installations.</small>
            </span>
          </span>
        </label>

        <StickerIdEditor name="welcomeWaveStickerIds" initialValue={discordBotSettings.welcome_wave_sticker_ids} />

        <label>
          <span>Officer Bot Log Channel</span>
          <DiscordResourceSelect
            name="officerLogChannelId"
            currentValue={discordBotSettings.officer_log_channel_id}
            emptyLabel="No officer log channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Party Planner Channel (Default)</span>
          <DiscordResourceSelect
            name="eventChannelId"
            currentValue={discordBotSettings.event_channel_id}
            emptyLabel="No Party Planner channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Mount Win Notification Channel</span>
          <DiscordResourceSelect
            name="mountWinChannelId"
            currentValue={discordBotSettings.mount_win_channel_id}
            emptyLabel="No mount-win channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Crafting / Workshop Channel</span>
          <DiscordResourceSelect
            name="craftingChannelId"
            currentValue={discordBotSettings.crafting_channel_id}
            emptyLabel="No crafting channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Treasure Map Channel</span>
          <DiscordResourceSelect
            name="treasureMapChannelId"
            currentValue={discordBotSettings.treasure_map_channel_id}
            emptyLabel="No automatic map channel"
            options={discordResourceDiscovery?.channels || []}
          />
          <small>Only images posted directly in this channel are checked automatically. Other channels remain ignored.</small>
        </label>

        <label>
          <span>Automatic Treasure Map Matching</span>
          <span className="checkbox-row">
            <input type="checkbox" name="treasureMapAutoEnabled" defaultChecked={discordBotSettings.treasure_map_auto_enabled} />
            <span><strong>Reply publicly to map images in the selected channel</strong><small>The private /fae map command and Identify Treasure Map message action remain available separately.</small></span>
          </span>
        </label>

        <label>
          <span>Test Channel</span>
          <DiscordResourceSelect
            name="testChannelId"
            currentValue={discordBotSettings.test_channel_id}
            emptyLabel="No test channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Member Rename Notification Channel</span>
          <DiscordResourceSelect
            name="memberRenameNotificationChannelId"
            currentValue={discordBotSettings.member_rename_notification_channel_id}
            emptyLabel="No rename notification channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Gaming Setups Gallery Channel</span>
          <DiscordResourceSelect
            name="gamingSetupsChannelId"
            currentValue={discordBotSettings.gaming_setups_channel_id}
            emptyLabel="No gaming setup channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Fur Babies Gallery Channel</span>
          <DiscordResourceSelect
            name="petsGalleryChannelId"
            currentValue={discordBotSettings.pets_gallery_channel_id}
            emptyLabel="No pet gallery channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Glamours Gallery Channel</span>
          <DiscordResourceSelect
            name="glamoursGalleryChannelId"
            currentValue={discordBotSettings.glamours_gallery_channel_id}
            emptyLabel="No glamour gallery channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Artwork Gallery Channel</span>
          <DiscordResourceSelect
            name="artworkGalleryChannelId"
            currentValue={discordBotSettings.artwork_gallery_channel_id}
            emptyLabel="No artwork gallery channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Giveaway Channel</span>
          <DiscordResourceSelect name="giveawayChannelId" currentValue={discordBotSettings.giveaway_channel_id} emptyLabel="No giveaway channel" options={discordResourceDiscovery?.channels || []} />
        </label>

        <label>
          <span>Contestants Channel</span>
          <DiscordResourceSelect name="contestantsChannelId" currentValue={discordBotSettings.contestants_channel_id} emptyLabel="No contestants channel" options={discordResourceDiscovery?.channels || []} />
        </label>

        <label>
          <span>Fashion Report Channel</span>
          <DiscordResourceSelect
            name="fashionReportChannelId"
            currentValue={discordBotSettings.fashion_report_channel_id}
            emptyLabel="No Fashion Report channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Anime Rankings Channel</span>
          <DiscordResourceSelect
            name="animeRankingChannelId"
            currentValue={discordBotSettings.anime_ranking_channel_id}
            emptyLabel="No anime ranking channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Lodestone News Channel</span>
          <DiscordResourceSelect
            name="lodestoneNewsChannelId"
            currentValue={discordBotSettings.lodestone_news_channel_id}
            emptyLabel="No Lodestone news channel"
            options={discordResourceDiscovery?.channels || []}
          />
        </label>

        <label>
          <span>Notification window starts (Central Time)</span>
          <input
            name="notificationWindowStartTime"
            type="time"
            defaultValue={discordBotSettings.notification_window_start_time}
          />
        </label>

        <label>
          <span>Notification window ends (Central Time)</span>
          <input
            name="notificationWindowEndTime"
            type="time"
            defaultValue={discordBotSettings.notification_window_end_time}
          />
        </label>

        <label>
          <span>Roster scan interval hours</span>
          <input
            name="rosterScanIntervalHours"
            type="number"
            min="1"
            max="168"
            defaultValue={discordBotSettings.roster_scan_interval_hours ?? 24}
          />
        </label>
      </div>

<div className="discord-settings-toggles">
  <label>
    <input
      type="checkbox"
      name="mountWinAnnouncementsEnabled"
      defaultChecked={discordBotSettings.mount_win_announcements_enabled}
    />
    <span>Post mount-win congratulations in Discord</span>
    <small>Turn this off to mute mount-win posts server-wide. Wins detected while muted will not be posted later. When enabled, new wins wait until the current mount ownership scan finishes; private or unavailable member profiles do not hold everyone else&apos;s posts.</small>
  </label>

  <label>
    <input
      type="checkbox"
      name="animeEventSchedulingEnabled"
      defaultChecked={discordBotSettings.anime_event_scheduling_enabled}
    />
    <span>Create and update anime release events in Discord</span>
    <small>Turning this off stops new scheduling and updates. Existing Discord events are left in place.</small>
  </label>

  <label>
    <input
      type="checkbox"
      name="autoRenameEnabled"
      defaultChecked={discordBotSettings.auto_rename_enabled}
    />
    <span>Auto-rename verified members</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="notificationWindowEnabled"
      defaultChecked={discordBotSettings.notification_window_enabled}
    />
    <span>Limit automated public notifications to the daily sending window</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="fashionReportEnabled"
      defaultChecked={discordBotSettings.fashion_report_enabled}
    />
    <span>Post the validated weekly Fashion Report guide</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="animeRankingEnabled"
      defaultChecked={discordBotSettings.anime_ranking_enabled}
    />
    <span>Post the validated weekly r/anime Karma Ranking</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="lodestoneNewsEnabled"
      defaultChecked={discordBotSettings.lodestone_news_enabled}
    />
    <span>Post official Lodestone news, topics, notices, maintenance, status, updates, and Developers' Blog entries</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="renameNotificationsDiscordMembersEnabled"
      defaultChecked={discordBotSettings.rename_notifications_discord_members_enabled}
    />
    <span>Post name-change notices for active Discord members</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="renameNotificationsNonDiscordMembersEnabled"
      defaultChecked={discordBotSettings.rename_notifications_non_discord_members_enabled}
    />
    <span>Post name-change notices for current FC members not in Discord</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="logUnmatchedAttempts"
      defaultChecked={discordBotSettings.log_unmatched_attempts}
    />
    <span>Log unmatched or pending attempts</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="autoRoleEnabled"
      defaultChecked={discordBotSettings.auto_role_enabled}
    />
    <span>Auto-assign/remove verification roles</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="startupMemberSyncEnabled"
      defaultChecked={discordBotSettings.startup_member_sync_enabled}
    />
    <span>Run full member auto-match when bot starts</span>
  </label>

  <label>
    <input
      type="checkbox"
      name="autoRosterScanEnabled"
      defaultChecked={discordBotSettings.auto_roster_scan_enabled ?? false}
    />
    <span>Run automatic Discord roster scans</span>
  </label>
</div>

      <div className="discord-settings-actions">
        <button className="button primary" type="submit">
          Save Discord Bot Settings
        </button>
      </div>
    </form>
    </>
  ) : null}
</details>

{/* ------------------------- */}
{/* SUBSECTION: Discord Roster Review */}
{/* ------------------------- */}

<details id="officer-discord-scan-status" className="tracker-collapsible discord-roster-scan-status-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Scan Status</span>
      <h3>Discord Roster Scan Status</h3>
      <p>
        Last scan result, automatic scan timing, and next scheduled roster check.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <div className="discord-roster-control-grid">
    <article className="discord-roster-control-card">
      <span
        className={
          discordBotSettings?.auto_roster_scan_enabled ? "tag success" : "tag"
        }
      >
        Auto Scan
      </span>
      <strong>
        {discordBotSettings?.auto_roster_scan_enabled ? "Enabled" : "Disabled"}
      </strong>
      <p>
        Interval: {discordBotSettings?.roster_scan_interval_hours ?? 24} hour(s)
      </p>
    </article>

    <article className="discord-roster-control-card">
      <span className="tag">Last Requested</span>
      <strong>
        {formatShortDateTime(discordRosterScanStatus?.last_requested_at)}
      </strong>
      <p>{discordRosterScanStatus?.last_requested_by || "No scan recorded yet."}</p>
    </article>

    <article className="discord-roster-control-card">
      <span
        className={
          discordRosterScanStatus?.last_status === "completed"
            ? "tag success"
            : discordRosterScanStatus?.last_status === "failed"
              ? "tag danger"
              : discordRosterScanStatus?.last_status
                ? "tag warning"
                : "tag"
        }
      >
        Last Status
      </span>
      <strong>{discordRosterScanStatus?.last_status || "None"}</strong>
      <p>
        {discordRosterScanStatus?.last_completed_at
          ? `Completed: ${formatShortDateTime(discordRosterScanStatus.last_completed_at)}`
          : "No completed scan yet."}
      </p>
    </article>

    <article className="discord-roster-control-card">
      <span className="tag">Next Due</span>
      <strong>
        {discordBotSettings?.auto_roster_scan_enabled
          ? formatShortDateTime(discordRosterScanStatus?.next_due_at)
          : "Disabled"}
      </strong>
      <p>
        {discordBotSettings?.auto_roster_scan_enabled
          ? "The bot will queue the next scan when this time has passed."
          : "Automatic roster scans are currently off."}
      </p>
    </article>
  </div>

  <article className="panel">
    <span className="tag">Last Result</span>
    <h3>
      {discordRosterScanStatus?.last_result_message ||
        discordRosterScanStatus?.last_error_message ||
        "No scan result recorded yet"}
    </h3>
    <p>
      This panel reads from the same Discord action queue the bot already processes.
    </p>
  </article>
</details>

{/* ------------------------- */}
{/* SUBSECTION: UI Panel */}
{/* ------------------------- */}

<details id="officer-discord-scheduled-posts" className="tracker-collapsible discord-scheduled-posts-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Scheduled Posts</span>
      <h3>Discord Scheduled Posts</h3>
      <p>
        Create queued Discord messages for announcements, raid nights, mount farms,
        reminders, and future Ser Aymeric replacement features.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

<form className="discord-scheduled-post-form" action={createDiscordScheduledPost}>
  <div className="discord-settings-grid">
    <label>
      <span>Post Type</span>
      <select name="postType" defaultValue="custom">
        <option value="custom">Custom</option>
        <option value="raid">Raid</option>
        <option value="mount_farm">Mount Farm</option>
        <option value="reminder">Reminder</option>
      </select>
    </label>

    <label>
      <span>Target Channel</span>
      <select name="targetChannelKind" defaultValue={scheduledPostDefaultChannelKind}>
        <option value="event" disabled={!discordBotSettings?.event_channel_id}>
          Party Planner Channel
        </option>
        <option
          value="officer_log"
          disabled={!discordBotSettings?.officer_log_channel_id}
        >
          Officer Bot Log Channel
        </option>
        <option value="test" disabled={!discordBotSettings?.test_channel_id}>
          Test Channel
        </option>
      </select>
    </label>

    <label>
      <span>Post Date</span>
      <input
        name="scheduledDate"
        type="date"
        required
      />
    </label>

    <label>
      <span>Post Time</span>
      <input name="scheduledTime" type="time" required />
    </label>
  </div>

  <label className="wide-form-field">
    <span>Title</span>
    <input
      name="title"
      placeholder="Example: Friday Mount Farm"
      required
    />
  </label>

  <label className="wide-form-field">
    <span>Message</span>
    <textarea
      name="message"
      placeholder="Write the Discord message here."
      rows={5}
      required
    />
  </label>

  <div className="discord-settings-actions">
    <button className="button primary" type="submit">
      Schedule Discord Post
    </button>
  </div>
</form>

  <div className="discord-scheduled-post-list">
    {discordScheduledPosts.length > 0 ? (
      discordScheduledPosts.map((post) => (
        <article key={post.id} className="discord-scheduled-post-card">
          <div>
            <span
              className={
                post.status === "sent"
                  ? "tag success"
                  : post.status === "failed"
                    ? "tag danger"
                    : post.status === "cancelled"
                      ? "tag"
                      : "tag warning"
              }
            >
              {post.status}
            </span>
            <h4>{post.title}</h4>
            <p>{post.post_type} · {post.target_channel_kind}</p>
          </div>

          <div>
            <span>Post At</span>
            <strong>{formatShortDateTime(post.scheduled_for)}</strong>
            <p>Created by: {post.created_by || "Unknown"}</p>
          </div>

          <div>
            <span>Target Channel</span>
            <strong>{post.target_channel_id || "None"}</strong>
            <p>
              {post.sent_at
                ? `Sent: ${formatShortDateTime(post.sent_at)}`
                : post.error_message || "Waiting for scheduled time."}
            </p>
          </div>

          <div className="discord-scheduled-post-message">
            <span>Message</span>
            <p>{post.message}</p>
          </div>

          {post.status === "scheduled" ? (
            <form action={cancelDiscordScheduledPost}>
              <input type="hidden" name="postId" value={post.id} />
              <button className="ghost-button danger" type="submit">
                Cancel
              </button>
            </form>
          ) : null}
        </article>
      ))
    ) : (
      <article className="panel">
        <span className="tag">No Posts</span>
        <h3>No scheduled Discord posts yet</h3>
        <p>
          Create one above. The bot processor will be added in the next step.
        </p>
      </article>
    )}
  </div>
</details>

<details id="officer-discord-duty-catalog" className="tracker-collapsible discord-duty-catalog-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Duty Catalog</span>
      <h3>Duty / Raid Catalog</h3>
      <p>
        Add duties, raids, trials, and images for event planner dropdowns.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <form className="discord-scheduled-post-form" action={saveDiscordDuty}>
    <div className="discord-settings-grid">
      <label>
        <span>Duty Type</span>
        <select name="dutyType" defaultValue="trial">
          <option value="trial">Trial</option>
          <option value="raid">Raid</option>
          <option value="alliance">Alliance Raid</option>
          <option value="dungeon">Dungeon</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <label>
        <span>Name</span>
        <input
          name="name"
          placeholder="Example: The Cloud Deck (Extreme)"
          required
        />
      </label>

      <label>
        <span>Expansion</span>
        <input
          name="expansion"
          placeholder="Example: Shadowbringers"
        />
      </label>

      <label>
        <span>Level</span>
        <input
          name="level"
          type="number"
          min="1"
          max="200"
          placeholder="Example: 80"
        />
      </label>

      <label>
        <span>Duty Party Size</span>
        <input name="partySize" type="number" min="1" max="24" placeholder="Example: 8" />
      </label>

      <label>
        <span>Image URL</span>
        <input
          name="imageUrl"
          placeholder="https://..."
        />
      </label>

      <label>
        <span>Sort Order</span>
        <input
          name="sortOrder"
          type="number"
          defaultValue="100"
        />
      </label>
    </div>

    <label className="wide-form-field">
      <span>Notes</span>
      <textarea
        name="notes"
        placeholder="Optional notes, unlock info, or loot notes."
        rows={3}
      />
    </label>

    <div className="discord-settings-actions">
      <button className="button primary" type="submit">
        Add / Update Duty
      </button>
    </div>
  </form>

  <div className="discord-scheduled-post-list">
    {discordDuties.length > 0 ? (
      discordDuties.map((duty) => (
        <article key={duty.id} className="discord-scheduled-post-card">
          <div>
            <span className="tag success">{duty.duty_type}</span>
            <h4>{duty.name}</h4>
            <p>{duty.expansion || "No expansion set"}</p>
          </div>

          <div>
            <span>Level</span>
            <strong>{duty.level ? `Level ${duty.level}` : "No level"}</strong>
            <p>Party size: {duty.party_size || "Not set"} - Sort: {duty.sort_order}</p>
          </div>

          <div>
          <span>Image</span>
          <strong>{duty.image_url ? "Configured" : "No image"}</strong>
          <p>
            {duty.manual_override ? "Manual override" : "Auto-synced"}
            {duty.last_synced_at
              ? ` · Synced ${formatShortDate(duty.last_synced_at)}`
              : ""}
          </p>
          </div>

          <div className="discord-scheduled-post-message">
            <span>Notes</span>
            <p>{duty.notes || "No notes."}</p>
          </div>

          <form action={hideDiscordDuty}>
            <input type="hidden" name="dutyId" value={duty.id} />
            <button className="ghost-button danger" type="submit">
              Hide
            </button>
          </form>
        </article>
      ))
    ) : (
      <article className="panel">
        <span className="tag">No Duties</span>
        <h3>No duties or raids added yet</h3>
        <p>
          Add your first duty above. The next step will connect this catalog to
          the event planner dropdown.
        </p>
      </article>
    )}
  </div>
</details>

<details id="officer-discord-events" className="tracker-collapsible discord-events-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Events</span>
      <h3>Raid and Mount Farm Planner</h3>
      <p>
        Create structured raid and mount farm events. Discord announcement generation
        will be connected in the next step.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <form className="discord-scheduled-post-form" action={createDiscordEvent}>
    <div className="discord-settings-grid">
      <label>
        <span>Event Type</span>
        <select name="eventType" defaultValue="mount_farm">
          <option value="mount_farm">Mount Farm</option>
          <option value="raid">Raid</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <label>
        <span>Target Channel</span>
        <select name="targetChannelKind" defaultValue="event">
          <option value="event" disabled={!discordBotSettings?.event_channel_id}>
            Party Planner Channel
          </option>
          <option value="officer_log" disabled={!discordBotSettings?.officer_log_channel_id}>
            Officer Bot Log Channel
          </option>
          <option value="test" disabled={!discordBotSettings?.test_channel_id}>
            Test Channel
          </option>
        </select>
      </label>

      <label>
        <span>Event Date</span>
        <input
          name="eventDate"
          type="date"
          required
        />
      </label>

      <label>
        <span>Event Time</span>
        <input name="eventTime" type="time" required />
      </label>

      <label>
        <span>Announcement Date</span>
        <input
          name="announcementDate"
          type="date"
        />
      </label>

      <label>
        <span>Announcement Time</span>
        <input name="announcementTime" type="time" />
      </label>

      <label>
        <span>Level</span>
        <input
          name="level"
          type="number"
          min="1"
          max="200"
          placeholder="Example: 90"
        />
      </label>

      <label>
        <span>Party Strategy</span>
        <select name="partyStrategy" defaultValue="rotation">
          <option value="rotation">Rotation / Overflow</option>
          <option value="split">Split Teams</option>
        </select>
      </label>

      <label>
        <span>Party Size Override</span>
        <input name="partySize" type="number" min="1" max="24" placeholder="Uses duty size or 8" />
      </label>

      <label>
        <span>Mount Target</span>
        <select name="mountId" defaultValue="">
          <option value="">No mount selected</option>
          {discordEventMountOptions.map((mount) => (
            <option key={mount.id} value={mount.id}>
              {mount.mount_name}
              {mount.expansion ? ` · ${mount.expansion}` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>

    <label className="wide-form-field">
      <span>Title</span>
      <input
        name="title"
        placeholder="Example: Friday Mount Farm"
        required
      />
    </label>

<label className="wide-form-field">
  <span>Duty / Raid</span>
  <select name="dutyId" defaultValue="">
    <option value="">No duty selected</option>
    {discordDuties.map((duty) => (
      <option key={duty.id} value={duty.id}>
        {duty.name}
        {duty.level ? ` · Level ${duty.level}` : ""}
        {duty.expansion ? ` · ${duty.expansion}` : ""}
      </option>
    ))}
  </select>
</label>

<label className="wide-form-field">
  <span>Duty Image Override URL</span>
  <input
    name="dutyImageUrl"
    placeholder="Optional override. Leave blank to use catalog image."
  />
</label>

    <label className="wide-form-field">
      <span>Description</span>
      <textarea
        name="description"
        placeholder="Event notes, requirements, loot rules, or goals."
        rows={5}
      />
    </label>

    <div className="discord-settings-toggles wide-form-field">
      <label>
        <input name="standardPartyRolesRequired" type="checkbox" defaultChecked />
        Require standard tank, healer, and DPS composition
      </label>
      <label>
        <input name="checkInRequired" type="checkbox" />
        Require participants to check in before joining active parties
      </label>
      <label>
        <input name="reminder24Hours" type="checkbox" defaultChecked />
        Post a live-roster reminder 24 hours before the event
      </label>
      <label>
        <input name="reminder1Hour" type="checkbox" defaultChecked />
        Post a live-roster reminder 1 hour before the event
      </label>
    </div>

    <div className="discord-settings-actions">
      <button className="button primary" type="submit">
        Create Event
      </button>
    </div>
  </form>

  <details className="event-template-panel" open={eventTemplates.length > 0 || eventSeries.length > 0}>
    <summary>
      <div>
        <span className="tag">Templates & Recurrence</span>
        <h4>Reusable Events</h4>
        <p>Copies and recurring occurrences get independent RSVPs and Discord posts.</p>
      </div>
      <span>{eventTemplates.length} template{eventTemplates.length === 1 ? "" : "s"} - {eventSeries.length} series</span>
    </summary>

    {eventTemplates.length > 0 ? (
      <div className="event-template-grid">
        {eventTemplates.map((template) => (
          <article key={template.id} className="event-template-card">
            <div className="event-template-card-heading">
              <div><span className="tag success">{template.event_type.replaceAll("_", " ")}</span><h5>{template.name}</h5></div>
              <form action={deleteEventTemplate}>
                <input type="hidden" name="templateId" value={template.id} />
                <button className="ghost-button danger" type="submit">Delete Template</button>
              </form>
            </div>
            <p><strong>{template.title}</strong> - {template.duty_name || template.mount_name || "Custom event"}</p>
            <p>{template.party_strategy === "split" ? "Split Teams" : "Rotation"} - {template.party_size} per party - {template.standard_party_roles_required ? "standard roles" : "flexible composition"} - {template.check_in_required ? "check-in required" : "no check-in"} - announce {template.announcement_lead_minutes === 0 ? "immediately" : `${template.announcement_lead_minutes / 1440} day(s) ahead`}</p>

            <form className="event-template-copy-form" action={createEventFromTemplate}>
              <input type="hidden" name="templateId" value={template.id} />
              <label><span>One-Time Date</span><input name="eventDate" type="date" required /></label>
              <label><span>Time</span><input name="eventTime" type="time" required /></label>
              <button className="ghost-button" type="submit">Create Copy</button>
            </form>

            <form className="event-series-create-form" action={createEventSeriesFromTemplate}>
              <input type="hidden" name="templateId" value={template.id} />
              <label><span>Series Name</span><input name="seriesName" defaultValue={template.name} required /></label>
              <label><span>Repeats</span><select name="recurrenceKind" defaultValue="weekly"><option value="weekly">Weekly</option><option value="biweekly">Every 2 Weeks</option><option value="monthly">Monthly</option></select></label>
              <label><span>First Date</span><input name="startDate" type="date" required /></label>
              <label><span>Time</span><input name="startTime" type="time" required /></label>
              <label><span>End Date</span><input name="endDate" type="date" /></label>
              <label><span>Keep Ahead</span><input name="occurrencesAhead" type="number" min="1" max="8" defaultValue="4" required /></label>
              <button className="button primary" type="submit">Start Series</button>
            </form>
          </article>
        ))}
      </div>
    ) : <p className="event-template-empty">Save a planned event as a template from its event card below.</p>}

    {eventSeries.length > 0 ? (
      <div className="event-series-list">
        {eventSeries.map((series) => (
          <article key={series.id} className="event-series-card">
            <div><span className={series.active ? "tag success" : series.ended_at ? "tag danger" : "tag warning"}>{series.active ? "Active" : series.ended_at ? "Ended" : "Paused"}</span><h5>{series.series_name}</h5><p>{series.recurrence_kind.replace("biweekly", "every 2 weeks")} - {series.generated_count} generated</p></div>
            <div><span>Next Generation Date</span><strong>{formatShortDateTime(series.next_occurrence_at)}</strong><p>{series.end_at ? `Ends ${formatShortDate(series.end_at)}` : "No end date"} - keeps {series.occurrences_ahead} ahead</p></div>
            <div className="event-series-actions">
              {!series.ended_at ? (
                <form action={manageEventSeries}><input type="hidden" name="seriesId" value={series.id} /><input type="hidden" name="seriesAction" value={series.active ? "pause" : "resume"} /><button className="ghost-button" type="submit">{series.active ? "Pause" : "Resume"}</button></form>
              ) : null}
              {!series.ended_at ? (
                <form action={manageEventSeries}><input type="hidden" name="seriesId" value={series.id} /><input type="hidden" name="seriesAction" value="end" /><button className="ghost-button danger" type="submit">End Series</button></form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    ) : null}
  </details>
  {discordEvents.some((event) => event.status === "cancelled" || event.status === "expired") ? (
    <div className="discord-settings-actions">
      <form action={clearAllDiscordEvents}>
        <button className="ghost-button danger" type="submit">
          Clear All Cancelled / Expired
        </button>
      </form>
    </div>
  ) : null}

  <div className="discord-scheduled-post-list">
    {discordEvents.length > 0 ? (
      discordEvents.map((event) => (
        <article key={event.id} className="discord-scheduled-post-card">
          <div>
            <span
              className={
                event.status === "cancelled" ? "tag danger" : event.status === "expired" ? "tag warning" : "tag success"
              }
            >
              {event.status}
            </span>
            <h4>{event.title}</h4>
            <p>{event.event_type}{event.series_name ? ` - ${event.series_name} #${event.series_occurrence_number}` : ""}</p>
          </div>

          <div>
            <span>Event Starts</span>
            <strong>{formatShortDateTime(event.event_starts_at)}</strong>
            <p>
              Announcement:{" "}
              {event.announcement_post_at
                ? formatShortDateTime(event.announcement_post_at)
                : "Not scheduled yet"}
            </p>
          </div>

          <div>
            <span>Details</span>
            <strong>
              {formatEventLevelRange(event.level, event.level_max)}
            </strong>
            <p>{event.duty_name || "No duty selected"}</p>
          </div>

          <div className="discord-scheduled-post-message">
            <span>Description</span>
            <p>{event.description || "No description provided."}</p>
          </div>

          {event.status === "planned" ? (
            <form className="event-save-template-form" action={saveEventAsTemplate}>
              <input type="hidden" name="eventId" value={event.id} />
              <label><span>Template Name</span><input name="templateName" defaultValue={event.title} required /></label>
              <label><span>Discord Announcement</span><select name="announcementLeadMinutes" defaultValue="10080"><option value="10080">7 days before</option><option value="4320">3 days before</option><option value="1440">24 hours before</option><option value="0">As soon as generated</option></select></label>
              <button className="ghost-button" type="submit">Save as Template</button>
            </form>
          ) : null}
          {event.status === "planned" ? (
            <details className="event-edit-panel">
              <summary>
                <span>Edit Event &amp; Discord Post</span>
                <small>
                  {event.last_edited_at
                    ? `Last changed ${formatShortDateTime(event.last_edited_at)} by ${event.last_edited_by || "Unknown officer"}`
                    : "Changes update the original Discord post while preserving RSVPs"}
                </small>
              </summary>
              <form className="event-edit-form" action={editDiscordEvent}>
                <input type="hidden" name="eventId" value={event.id} />
                <div className="event-edit-grid">
                  <label>
                    <span>Event Type</span>
                    <select name="eventType" defaultValue={event.event_type}>
                      <option value="mount_farm">Mount Farm</option>
                      <option value="raid">Raid</option>
                      <option value="trial">Trial</option>
                      <option value="treasure_maps">Maps</option>
                      <option value="dungeon">Dungeon</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label>
                    <span>Input Timezone</span>
                    <select name="eventTimeZone" defaultValue={event.event_time_zone}>{memberEventTimeZoneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </label>
                  <label>
                    <span>Event Date</span>
                    <input name="eventDate" type="date" defaultValue={getEventEditDatePart(event.event_starts_at, event.event_time_zone)} required />
                  </label>
                  <label>
                    <span>Event Time</span>
                    <input name="eventTime" type="time" defaultValue={getEventEditTimePart(event.event_starts_at, event.event_time_zone)} required />
                  </label>
                  <label>
                    <span>Minimum Level</span>
                    <input name="level" type="number" min="1" max="200" defaultValue={event.level || ""} />
                  </label>
                  <label>
                    <span>Maximum Level</span>
                    <input name="levelMax" type="number" min="1" max="200" defaultValue={event.level_max || ""} />
                  </label>
                  <label>
                    <span>Duty / Raid</span>
                    <select name="dutyId" defaultValue={event.duty_id || ""}>
                      <option value="">No duty selected</option>
                      {discordDuties.map((duty) => (
                        <option key={duty.id} value={duty.id}>{duty.name}{duty.level ? ` - Level ${duty.level}` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Mount Target</span>
                    <select name="mountId" defaultValue={event.mount_id || ""}>
                      <option value="">No mount selected</option>
                      {discordEventMountOptions.map((mount) => (
                        <option key={mount.id} value={mount.id}>{mount.mount_name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Party Mode</span>
                    <select name="partyStrategy" defaultValue={event.party_strategy}>
                      <option value="rotation">Rotation / Overflow</option>
                      <option value="split">Split Teams</option>
                    </select>
                  </label>
                  <label>
                    <span>Party Size</span>
                    <input name="partySize" type="number" min="1" max="24" defaultValue={event.party_size} required />
                  </label>
                </div>
                <label className="wide-form-field">
                  <span>Title</span>
                  <input name="title" defaultValue={event.title} required />
                </label>
                <label className="wide-form-field">
                  <span>Duty Image URL</span>
                  <input name="dutyImageUrl" defaultValue={event.duty_image_url || ""} placeholder="Optional catalog-image override" />
                </label>
                <label className="wide-form-field">
                  <span>Description</span>
                  <textarea name="description" rows={4} defaultValue={event.description} />
                </label>
                <div className="event-edit-toggles">
                  <label><input name="standardPartyRolesRequired" type="checkbox" defaultChecked={event.standard_party_roles_required} /> Require standard tank, healer, and DPS composition</label>
                  <label><input name="checkInRequired" type="checkbox" defaultChecked={event.check_in_required} /> Require participant check-in</label>
                  <label><input name="rosterLocked" type="checkbox" defaultChecked={event.roster_locked} /> Lock RSVP roster</label>
                  <label><input name="reminder24Hours" type="checkbox" defaultChecked={event.reminder_24h_enabled} /> 24-hour reminder</label>
                  <label><input name="reminder1Hour" type="checkbox" defaultChecked={event.reminder_1h_enabled} /> 1-hour reminder</label>
                </div>
                <div className={`event-edit-warning ${event.roster_locked || new Date(event.event_starts_at).getTime() <= Date.now() ? "active" : ""}`}>
                  <strong>Restricted edit confirmation</strong>
                  <p>Required if the roster is locked, the event has started, or the new time is in the past. Existing RSVPs will be retained.</p>
                  <label><input name="confirmRestrictedEdit" type="checkbox" /> I understand and want to apply this change.</label>
                </div>
                <div className="discord-settings-actions">
                  <button className="button primary" type="submit">Save &amp; Update Discord Post</button>
                </div>
              </form>
            </details>
          ) : null}

          {event.status === "planned" ? (
            <form action={cancelDiscordEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <button className="ghost-button danger" type="submit">
                Cancel
              </button>
            </form>
          ) : event.status === "cancelled" || event.status === "expired" ? (
            <form action={clearDiscordEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <button className="ghost-button danger" type="submit">
                Clear
              </button>
            </form>
          ) : null}
        </article>
      ))
    ) : (
      <article className="panel">
        <span className="tag">No Events</span>
        <h3>No raid or mount farm events yet</h3>
        <p>
          Create one above. Announcement posting will be connected in the next step.
        </p>
      </article>
    )}
  </div>
</details>

{/* ------------------------- */}
{/* SUBSECTION: Discord Action Queue */}
{/* ------------------------- */}

<details id="officer-discord-action-queue" className="tracker-collapsible discord-action-queue-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Action Queue</span>
      {discordQueueStats.failed > 0 ? <span className="officer-card-notification danger">{discordQueueStats.failed} failed</span> : null}
      {discordQueueStats.pending + discordQueueStats.needs_confirmation + discordQueueStats.processing > 0 ? <span className="officer-card-notification warning">{discordQueueStats.pending + discordQueueStats.needs_confirmation + discordQueueStats.processing} pending</span> : null}
      {discordQueueStats.failed === 0 && discordQueueStats.total_open === 0 ? <span className="officer-card-notification success">Clear</span> : null}
      <h3>Pending Discord Actions</h3>
      <p>
        Officer-requested Discord actions waiting for the bot to process.
        These are queued only until the bot executor is added.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  {discordActionQueue.some((item) =>
    item.status === "completed" || item.status === "failed" || item.status === "cancelled"
  ) ? (
    <div className="discord-settings-actions">
      <form action={clearAllDiscordActionHistory}>
        <button className="ghost-button danger" type="submit">
          Clear All Completed / Failed / Cancelled
        </button>
      </form>
    </div>
  ) : null}

  <div className="discord-action-queue-list">
    {discordActionQueue.length > 0 ? (
      discordActionQueue.map((item) => {
        const displayName =
          item.discord_user_id === "__guild_roster_scan__"
            ? "Guild Roster Scan"
            : item.discord_display_name ||
              item.discord_username ||
              item.discord_user_id;

        return (
          <article key={item.id} className="discord-action-queue-card">
            <div>
              <span className={`tag ${item.status === "pending" || item.status === "needs_confirmation" ? "warning" : ""}`}>
                {item.status}
              </span>
              <h4>{displayName}</h4>
              <p>Discord ID: {item.discord_user_id}</p>
            </div>

            <div>
              <span>Action</span>
              <strong>{item.action_type}</strong>
              <p>{item.character_name || "No linked character"}</p>
            </div>

            <div>
              <span>Requested</span>
              <strong>{formatShortDateTime(item.requested_at)}</strong>
              <p>{item.requested_by || "Unknown officer"}</p>
            </div>

<div>
  <span>Result</span>
  <strong>{item.completed_at ? formatShortDateTime(item.completed_at) : "Not completed"}</strong>
  <p>{item.error_message || item.result_message || item.action_note || "Waiting for bot executor."}</p>
</div>

<div className="discord-action-queue-controls">
{item.action_type === "kick_member" && item.status === "needs_confirmation" ? (
  <form action={manageDiscordQueuedAction}>
    <input type="hidden" name="actionId" value={item.id} />
    <input type="hidden" name="queueAction" value="confirm_kick" />
    <button className="ghost-button danger" type="submit">
      Confirm Kick
    </button>
  </form>
) : null}

  {item.status === "failed" || item.status === "processing" ? (
    <form action={manageDiscordQueuedAction}>
      <input type="hidden" name="actionId" value={item.id} />
      <input type="hidden" name="queueAction" value="retry" />
      <button className="ghost-button" type="submit">
        Retry
      </button>
    </form>
  ) : null}

  {item.status === "pending" || item.status === "processing" || item.status === "failed" ? (
    <form action={manageDiscordQueuedAction}>
      <input type="hidden" name="actionId" value={item.id} />
      <input type="hidden" name="queueAction" value="cancel" />
      <button className="ghost-button danger" type="submit">
        Cancel
      </button>
    </form>
  ) : null}

  {item.status === "completed" || item.status === "failed" || item.status === "cancelled" ? (
    <form action={manageDiscordQueuedAction}>
      <input type="hidden" name="actionId" value={item.id} />
      <input type="hidden" name="queueAction" value="clear" />
      <button className="ghost-button" type="submit">
        Clear
      </button>
    </form>
  ) : null}
</div>
          </article>
        );
      })
    ) : (
      <article className="panel">
        <span className="tag success">Clear</span>
        <h3>No queued Discord actions</h3>
        <p>
          Actions queued from roster review cards will appear here.
        </p>
      </article>
    )}
  </div>
</details>

{/* ------------------------- */}
{/* SUBSECTION: Discord Roster Control Summary */}
{/* ------------------------- */}

<details id="officer-discord-roster-overview" className="tracker-collapsible officer-tool-card">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className={discordQueueStats.failed > 0 ? "tag danger" : discordRosterReviews.length + discordMemberSnapshotReviews.length + discordQueueStats.total_open > 0 ? "tag warning" : "tag success"}>Roster Status</span>
      {discordQueueStats.failed > 0 ? <span className="officer-card-notification danger">{discordQueueStats.failed} failed</span> : null}
      {discordRosterReviews.length + discordMemberSnapshotReviews.length + discordQueueStats.total_open > 0 ? <span className="officer-card-notification warning">{discordRosterReviews.length + discordMemberSnapshotReviews.length + discordQueueStats.total_open} attention</span> : <span className="officer-card-notification success">Clear</span>}
      <h3>Discord Roster Overview</h3><p>Review roster flags and Discord action totals.</p>
    </div>
    <span className="tracker-collapsible-toggle">Open</span>
  </summary>
  <div className="officer-tool-content">
<section className="discord-roster-control-summary">
  <article className="discord-roster-control-card">
    <span className="tag">Roster Reviews</span>
    <strong>{discordRosterReviews.length}</strong>
    <p>Discord users currently flagged for officer review.</p>
  </article>

  <article className="discord-roster-control-card">
    <span className="tag warning">Needs Confirmation</span>
    <strong>{discordQueueStats.needs_confirmation}</strong>
    <p>Kick review actions waiting for second confirmation.</p>
  </article>

  <article className="discord-roster-control-card">
    <span className="tag warning">Pending</span>
    <strong>{discordQueueStats.pending}</strong>
    <p>Actions waiting for the Discord bot to process.</p>
  </article>

  <article className="discord-roster-control-card">
    <span className={discordQueueStats.failed > 0 ? "tag danger" : "tag success"}>
      Failed
    </span>
    <strong>{discordQueueStats.failed}</strong>
    <p>Actions that need officer attention or retry.</p>
  </article>

  <article className="discord-roster-control-card">
    <span className="tag success">Completed</span>
    <strong>{discordQueueStats.completed}</strong>
    <p>Actions successfully processed or safely skipped by the bot.</p>
  </article>
</section>

<article className="discord-roster-control-card">
  <span className={discordMemberSnapshotReviews.length > 0 ? "tag warning" : "tag success"}>
    Scan Flags
  </span>
  <strong>{discordMemberSnapshotReviews.length}</strong>
  <p>Verified Discord users without a valid current FC link.</p>
</article>
</div>
</details>

{/* ------------------------- */}
{/* SUBSECTION: Discord Roster Scan */}
{/* ------------------------- */}

<details
  id="officer-discord-roster-scan"
  className="tracker-collapsible discord-member-scan-panel"
  open={discordMemberSnapshotReviews.length > 0}
>
  <summary className="tracker-collapsible-summary">
    <div>
      <span className="tag">Discord Scan</span>
      <h3>Discord Server Roster Scan</h3>
      <p>
        Audit verified Discord users for missing or outdated links, or run a
        separate exact-name match against the current FC roster.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

  <div className="discord-roster-scan-actions">
    <form action={queueDiscordRosterScan}>
      <label>
        <span>Scan Note</span>
        <input
          name="note"
          placeholder="Optional note, ex: weekly roster check"
        />
      </label>

      <div className="discord-roster-scan-buttons">
        <button
          className="ghost-button"
          type="submit"
          title="Refreshes the Discord roster audit. It does not create character links."
        >
          Queue Discord Roster Scan
        </button>
        <button
          className="primary-button"
          type="submit"
          formAction={queueDiscordNameMatch}
          title="Matches unlinked members by exact Discord nickname, display name, global name, or username, then applies the configured verified state."
        >
          Queue Discord Name Match
        </button>
      </div>
    </form>
    <p className="discord-roster-scan-help">
      Name Match skips valid existing links and only saves an unambiguous exact
      match to an active current FC character. It also refreshes this audit when finished.
    </p>
  </div>

  <div className="discord-member-scan-list">
    {discordMemberSnapshotReviews.length > 0 ? (
      discordMemberSnapshotReviews.map((member) => {
        const displayName =
          member.discord_display_name ||
          member.discord_nickname ||
          member.discord_global_name ||
          member.discord_username ||
          member.discord_user_id;
        const isProtectedAdministrator = protectedPortalAdminDiscordIds.has(member.discord_user_id);

        return (
          <article key={member.discord_user_id} className="discord-member-scan-card">
            <div>
              <span className="tag warning">{isProtectedAdministrator ? "Admin · Link Needed" : "Needs Review"}</span>
              <h4>{displayName}</h4>
              <p>Discord ID: {member.discord_user_id}</p>
            </div>

            <div>
              <span>Discord Roles</span>
              <strong>
                {member.has_verified_role ? "Verified" : "Not verified"}
                {member.has_unverified_role ? " · Unverified" : ""}
              </strong>
              <p>{member.is_bot ? "Bot account" : "Human account"}</p>
            </div>

            <div>
              <span>Linked Character</span>
              <strong>
                {member.linked_character_name
                  ? `${member.linked_character_name}${member.linked_world ? ` · ${member.linked_world}` : ""}`
                  : "No linked character"}
              </strong>
              <p>
                FC status: {member.linked_fc_status || "Unknown"}
                {member.linked_active === false ? " · inactive" : ""}
              </p>
            </div>

            <div>
              <span>Last Scanned</span>
              <strong>{formatShortDateTime(member.last_scanned_at)}</strong>
              <p>{isProtectedAdministrator ? "Portal administrator access is protected. Bind the correct current FC character below." : member.review_reason || "Review recommended."}</p>
            </div>

            <div className="discord-member-bind-form">
              <DiscordLinkAssignmentForm
                action={bindDiscordMemberCharacter}
                mode="bind"
                discordUserId={member.discord_user_id}
                characterOptions={joinDateCharacters.map((character) => ({
                  value: String(character.id),
                  label: `${character.character_name} · ${character.world}`
                }))}
              />
            </div>

<div className="discord-roster-queue-actions">
  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={member.discord_user_id} />
    <input type="hidden" name="actionType" value="send_officer_alert" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Optional note for officer alert"
      />
    </label>

    <button className="ghost-button" type="submit">
      Queue Officer Alert
    </button>
  </form>

  {!isProtectedAdministrator ? <>
  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={member.discord_user_id} />
    <input type="hidden" name="actionType" value="remove_verified_role" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Optional note for audit trail"
      />
    </label>

    <button className="ghost-button danger" type="submit">
      Queue Remove Verified Role
    </button>
  </form>

  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={member.discord_user_id} />
    <input type="hidden" name="actionType" value="add_unverified_role" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Optional note for audit trail"
      />
    </label>

    <button className="ghost-button" type="submit">
      Queue Add Unverified Role
    </button>
  </form>

  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={member.discord_user_id} />
    <input type="hidden" name="actionType" value="kick_member" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Required reason recommended"
      />
    </label>

    <button className="ghost-button danger" type="submit">
      Queue Kick Review
    </button>
  </form>
  </> : <p className="protected-admin-note">Removal, unverified-role, and kick actions are disabled for portal administrators.</p>}
</div>
          </article>
        );
      })
    ) : (
      <article className="panel">
        <span className="tag success">Clear</span>
        <h3>No Discord scan flags</h3>
        <p>
          After the bot scans the server, verified Discord users without a valid
          FC link will appear here.
        </p>
      </article>
    )}
  </div>
</details>

{/* ------------------------- */}
{/* SUBSECTION: Discord Roster Review */}
{/* ------------------------- */}

<details id="officer-discord-roster-review" className="tracker-collapsible discord-roster-review-panel">
  <summary className="tracker-collapsible-summary">
    <div>
      <span className={discordRosterReviews.length > 0 ? "tag warning" : "tag success"}>Roster Review</span>
      {discordRosterReviews.length > 0 ? <span className="officer-card-notification warning">{discordRosterReviews.length} review{discordRosterReviews.length === 1 ? "" : "s"}</span> : <span className="officer-card-notification success">Clear</span>}
      <h3>Discord / FC Roster Review</h3>
      <p>
        Linked Discord users whose character is no longer marked as a current FC member.
        This is review-only for now. No roles are removed and nobody is kicked automatically.
      </p>
    </div>

    <span className="tracker-collapsible-toggle">Open</span>
  </summary>

<div className="discord-roster-test-actions">
  <form action={createTestDiscordRosterReview}>
    <button className="ghost-button" type="submit">
      Create Test Review
    </button>
  </form>

  <form action={clearTestDiscordRosterReview}>
    <button className="ghost-button danger" type="submit">
      Clear Test Review
    </button>
  </form>
</div>

  <div className="discord-roster-review-list">
    {discordRosterReviews.length > 0 ? (
      discordRosterReviews.map((review) => {
        const discordName =
          review.discord_display_name ||
          review.discord_nickname ||
          review.discord_global_name ||
          review.discord_username ||
          review.discord_user_id;

        return (
          <article key={review.discord_user_id} className="discord-roster-review-card">
            <div>
              <span className="tag warning">Review Needed</span>
              <h4>{discordName}</h4>
              <p>Discord ID: {review.discord_user_id}</p>
            </div>

            <div>
              <span>Linked Character</span>
              <strong>
                {review.character_name
                  ? `${review.character_name}${review.world ? ` · ${review.world}` : ""}`
                  : "No linked character"}
              </strong>
              <p>{review.role || "No role recorded"}</p>
            </div>

            <div>
              <span>FC Status</span>
              <strong>{review.fc_membership_status || "Unknown"}</strong>
              <p>{review.active === false ? "Inactive character" : "Character record active"}</p>
            </div>

            <div>
              <span>Last Seen in FC</span>
              <strong>{formatShortDateTime(review.last_seen_in_fc_at)}</strong>
              <p>Discord seen: {formatShortDateTime(review.last_seen_at)}</p>
            </div>

<div className="discord-roster-review-reason">
  <span>Reason</span>
  <strong>{review.review_reason}</strong>

  {review.review_decision ? (
    <p>
      Decision: <strong>{review.review_decision}</strong>
      {review.review_decided_at
        ? ` · ${formatShortDateTime(review.review_decided_at)}`
        : ""}
      {review.review_decided_by ? ` · ${review.review_decided_by}` : ""}
    </p>
  ) : (
    <p>No officer decision recorded yet.</p>
  )}

  {review.review_note ? <p>Note: {review.review_note}</p> : null}
</div>

<div className="discord-roster-review-actions">
  <form action={updateDiscordRosterReviewDecision}>
    <input type="hidden" name="discordUserId" value={review.discord_user_id} />
    <input type="hidden" name="decision" value="guest_ignore" />

    <label>
      <span>Note</span>
      <input
        name="note"
        placeholder="Optional note, ex: approved guest"
        defaultValue={review.review_decision === "guest_ignore" ? review.review_note || "" : ""}
      />
    </label>

    <button className="ghost-button" type="submit">
      Mark Guest / Ignore
    </button>
  </form>

  <form action={updateDiscordRosterReviewDecision}>
    <input type="hidden" name="discordUserId" value={review.discord_user_id} />
    <input type="hidden" name="decision" value="kick_review" />

    <label>
      <span>Note</span>
      <input
        name="note"
        placeholder="Optional note, ex: left FC"
        defaultValue={review.review_decision === "kick_review" ? review.review_note || "" : ""}
      />
    </label>

    <button className="ghost-button danger" type="submit">
      Needs Kick Review
    </button>
  </form>

  {review.review_decision ? (
    <form action={updateDiscordRosterReviewDecision}>
      <input type="hidden" name="discordUserId" value={review.discord_user_id} />
      <input type="hidden" name="decision" value="clear" />

      <button className="ghost-button" type="submit">
        Clear Decision
      </button>
    </form>
  ) : null}
</div>

<div className="discord-roster-queue-actions">
  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={review.discord_user_id} />
    <input type="hidden" name="actionType" value="remove_verified_role" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Optional note for audit trail"
      />
    </label>

    <button className="ghost-button danger" type="submit">
      Queue Remove Verified Role
    </button>
  </form>

  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={review.discord_user_id} />
    <input type="hidden" name="actionType" value="add_unverified_role" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Optional note for audit trail"
      />
    </label>

    <button className="ghost-button" type="submit">
      Queue Add Unverified Role
    </button>
  </form>

  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={review.discord_user_id} />
    <input type="hidden" name="actionType" value="send_officer_alert" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Optional note for officer alert"
      />
    </label>

    <button className="ghost-button" type="submit">
      Queue Officer Alert
    </button>
  </form>

  <form action={queueDiscordRosterAction}>
    <input type="hidden" name="discordUserId" value={review.discord_user_id} />
    <input type="hidden" name="actionType" value="kick_member" />

    <label>
      <span>Queue Note</span>
      <input
        name="note"
        placeholder="Required reason recommended"
      />
    </label>

    <button className="ghost-button danger" type="submit">
      Queue Kick Review
    </button>
  </form>
</div>
          </article>
        );
      })
    ) : (
      <article className="panel">
        <span className="tag success">Clear</span>
        <h3>No Discord roster reviews needed</h3>
        <p>
          All linked Discord users currently point to active characters still marked as current FC members.
        </p>
      </article>
    )}
  </div>
</details>

            {/* ========================= */}
            <details id="officer-public-content" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary">
                <div>
                  <span className="tag">Public Pages</span>
                  <h3>FC Information and Links</h3>
                  <p>Edit the public recruitment copy and up to two additional community links without rebuilding.</p>
                </div>
                <span className="tracker-collapsible-toggle">Open</span>
              </summary>
              <div className="officer-tool-content">
                <form action={savePublicContentSettings} className="settings-form">
                  <div className="form-grid">
                    <label className="full">
                      <span>About the Free Company</span>
                      <textarea name="fcAboutText" defaultValue={settings.fcAboutText} rows={3} />
                    </label>
                    <label className="full">
                      <span>Activities</span>
                      <textarea name="fcActivitiesText" defaultValue={settings.fcActivitiesText} rows={3} />
                    </label>
                    <label className="full">
                      <span>Schedule and Availability</span>
                      <textarea name="fcScheduleText" defaultValue={settings.fcScheduleText} rows={3} />
                    </label>
                    <label className="full">
                      <span>Recruitment Message</span>
                      <textarea name="fcRecruitmentText" defaultValue={settings.fcRecruitmentText} rows={3} />
                    </label>
                    <label>
                      <span>FC House Name</span>
                      <input name="fcHouseName" defaultValue={settings.fcHouseName} maxLength={160} placeholder="Example: Free Company House" />
                    </label>
                    <label>
                      <span>FC House Location</span>
                      <input name="fcHouseLocation" defaultValue={settings.fcHouseLocation} maxLength={240} placeholder="Example: Empyreum, Ward 5, Plot 12" />
                    </label>
                    <label className="full">
                      <span>FC House Description</span>
                      <textarea name="fcHouseDescription" defaultValue={settings.fcHouseDescription} rows={3} />
                    </label>
                    <label>
                      <span>Additional Link One Label</span>
                      <input name="communityLinkOneLabel" defaultValue={settings.communityLinkOneLabel} placeholder="Example: Community Carrd" />
                    </label>
                    <label>
                      <span>Additional Link One URL</span>
                      <input name="communityLinkOneUrl" type="url" defaultValue={settings.communityLinkOneUrl} placeholder="https://..." />
                    </label>
                    <label>
                      <span>Additional Link Two Label</span>
                      <input name="communityLinkTwoLabel" defaultValue={settings.communityLinkTwoLabel} placeholder="Example: FFXIV Guides" />
                    </label>
                    <label>
                      <span>Additional Link Two URL</span>
                      <input name="communityLinkTwoUrl" type="url" defaultValue={settings.communityLinkTwoUrl} placeholder="https://..." />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="button primary" type="submit">Save Public Content</button>
                  </div>
                </form>

                <form action={uploadFcGalleryImages} encType="multipart/form-data" className="settings-form">
                  <div className="form-grid">
                    <label>
                      <span>Gallery Caption</span>
                      <input name="galleryTitle" maxLength={160} placeholder="Example: Our FC House" />
                    </label>
                    <label>
                      <span>Photo Description</span>
                      <input name="galleryAltText" maxLength={240} placeholder="Brief description for accessibility" />
                    </label>
                    <label className="full">
                      <span>Photos</span>
                      <input name="galleryImages" type="file" accept="image/jpeg,image/png,image/webp" multiple required />
                      <small>Upload only material you may publish; FFXIV screenshots remain subject to the current Materials Usage Policy.</small>
                      <small>Upload up to 4 JPG, PNG, or WebP images at a time. Each image can be up to 25 MB.</small>
                    </label>
                    <label className="full checkbox-row">
                      <input name="contentRights" type="checkbox" required />
                      <span><strong>I have permission to share these photos.</strong><small>I allow this installation to store and display them as described in the <a href="/legal" target="_blank" rel="noreferrer">content notice</a>.</small></span>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="button primary" type="submit">Upload Gallery Photos</button>
                  </div>
                </form>

                {fcGalleryImages.length > 0 ? (
                  <div className="stack-list">
                    {fcGalleryImages.map((image) => (
                      <article key={image.id} className="panel compact-row">
                        <div>
                          <h4>{image.title}</h4>
                          <small>Added {formatShortDateTime(image.created_at)}</small>
                        </div>
                        <div className="fc-gallery-officer-actions">
                          <details>
                            <summary>Edit photo details</summary>
                            <form action={saveFcGalleryImageDetails} className="fc-gallery-edit-form">
                              <input type="hidden" name="galleryImageId" value={image.id} />
                              <label><span>Caption</span><input name="galleryTitle" defaultValue={image.title} maxLength={160} required /></label>
                              <label><span>Description</span><input name="galleryAltText" defaultValue={image.alt_text} maxLength={240} placeholder="Brief description for accessibility" /></label>
                              <button className="button primary" type="submit">Save Photo Details</button>
                            </form>
                          </details>
                          <form action={archiveFcGalleryImage}>
                            <input type="hidden" name="galleryImageId" value={image.id} />
                            <button className="danger-button" type="submit">Remove Photo</button>
                          </form>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
            <details id="officer-announcements" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary">
                <div>
                  <span className="tag">Public Feed</span>
                  <h3>Announcements</h3>
                  <p>Publish community, raiding, crafting, or recruitment notices to the public portal.</p>
                </div>
                <span className="tracker-collapsible-toggle">Open</span>
              </summary>
              <div className="officer-tool-content">
                <form action={createPortalAnnouncement} className="settings-form">
                  <div className="form-grid">
                    <label>
                      <span>Category</span>
                      <select name="announcementCategory" defaultValue="Community">
                        <option value="Community">Community</option>
                        <option value="Raiding">Raiding</option>
                        <option value="Mount Farms">Mount Farms</option>
                        <option value="Crafting & Gathering">Crafting &amp; Gathering</option>
                        <option value="Guides & Resources">Guides &amp; Resources</option>
                        <option value="Recruitment">Recruitment</option>
                      </select>
                    </label>
                    <label>
                      <span>Title</span>
                      <input name="announcementTitle" required maxLength={160} placeholder="What should members and visitors know?" />
                    </label>
                    <label className="full">
                      <span>Message</span>
                      <textarea name="announcementBody" required rows={4} maxLength={4000} placeholder="Write the announcement shown on the public portal." />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="button primary" type="submit">Publish Announcement</button>
                  </div>
                </form>

                {portalAnnouncements.length > 0 ? (
                  <div className="stack-list">
                    {portalAnnouncements.map((announcement) => (
                      <article key={announcement.id} className="panel compact-row">
                        <div>
                          <span className="tag">{announcement.category}</span>
                          <h4>{announcement.title}</h4>
                          <p>{announcement.body}</p>
                          <small>Published {formatShortDateTime(announcement.published_at)}</small>
                        </div>
                        <form action={archivePortalAnnouncement}>
                          <input type="hidden" name="announcementId" value={announcement.id} />
                          <button className="danger-button" type="submit">Remove</button>
                        </form>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No officer-written announcements have been published yet.</p>
                )}
              </div>
            </details>
            <details id="officer-sync-status" className="tracker-collapsible officer-tool-card" open={fcVerification?.status !== "verified" ? true : undefined}>
              <summary className="tracker-collapsible-summary">
                <div>
                  <span className={fcVerification?.status === "verified" ? "tag success" : "tag warning"}>Ownership</span>
                  <h3>Sync Status</h3>
                  <p>{fcVerification?.status === "verified" ? "Free Company ownership is verified. Open for roster sync status." : "Action required: verify ownership through the Free Company Lodestone page."}</p>
                </div>
                <span className="tracker-collapsible-toggle">Open</span>
              </summary>
              <div className="officer-tool-content">
            {/* SECTION: Worker Sync Status */}
            {/* ========================= */}

            <div className="section-title-row">
              <div>
                <p className="eyebrow">Ownership and automation</p>
                <h2>Free Company Verification</h2>
                <p>
                  Recent background worker activity. This confirms the sync container can reach the database.
                </p>
              </div>
            </div>

            <article className="panel">
              <span className={fcVerification?.status === "verified" ? "tag success" : "tag warning"}>{fcVerification?.status === "verified" ? "FC Verified" : "Verification Required"}</span>
              <h3>Free Company ownership status</h3>
              {!fcVerification ? (
                <p>The worker is preparing the Free Company verification challenge. Refresh this page after it starts.</p>
              ) : fcVerification.status === "pending" ? (
                <div className="setup-warning">
                  <p><strong>Roster and character scanning are paused until one of these placements is visible on Lodestone:</strong></p>
                  <ol>
                    <li><strong>FC profile:</strong> edit the selected Free Company profile and place the exact code in public text, such as the slogan, company board, or estate profile.</li>
                    <li><strong>FC forum:</strong> create a new thread in this Free Company&apos;s forum, use the exact code as the thread title, and set its status to <strong>Public</strong>. The body can contain any brief explanation.</li>
                  </ol>
                  <p>Use this code exactly as shown:</p>
                  <p><code>{fcVerification.verification_code}</code></p>
                  <p>The worker checks both locations about every 15 minutes. Forum drafts, Members Only threads, and codes placed only inside a thread body are not visible on the public forum listing. Leave the code in place until this panel reports <strong>FC Verified</strong>; it can then be removed.</p>
                  {fcVerification.last_checked_at ? <small>Last checked {formatShortDateTime(fcVerification.last_checked_at)}{fcVerification.last_error ? ` · ${fcVerification.last_error}` : ""}</small> : null}
                  <LiveBackgroundAction
                    action={queueFcVerificationCheck}
                    statusAction={getOfficerBackgroundActionStatus}
                    statusKind="fc-verification"
                    idleLabel="Check Verification Now"
                    pendingLabel="Queueing check..."
                    queuedLabel="Verification check queued"
                  />
                  <small>The worker will prioritize this request, normally within one minute. This panel refreshes automatically while the check runs.</small>
                </div>
              ) : (
                <p>Verified FC {fcVerification.fc_lodestone_id} on {fcVerification.world} ({fcVerification.datacenter}) for Discord server {fcVerification.discord_guild_id}. Environment edits cannot redirect the worker while this signed identity remains valid.</p>
              )}
              <p>
                Queue an immediate FC roster comparison. The worker records every confirmed addition and removal below.
              </p>
              <LiveBackgroundAction
                action={queueFcRosterScan}
                statusAction={getOfficerBackgroundActionStatus}
                statusKind="fc-roster"
                idleLabel="Queue FC Roster Scan"
                pendingLabel="Queueing scan..."
                queuedLabel="FC roster scan queued"
                disabled={fcVerification?.status !== "verified"}
              />
              <div className="activity-list">
                {fcRosterAuditChanges.length > 0 ? fcRosterAuditChanges.map((change) => (
                  <p key={change.id}>
                    <strong>{change.change_type === "added" ? "Added" : "Removed"}:</strong>{" "}
                    {change.character_name} · {change.world} · {formatShortDateTime(change.detected_at)}
                    {change.scan_source === "manual" ? " · Manual scan" : ""}
                  </p>
                )) : <p className="muted">No FC roster changes have been recorded yet.</p>}
              </div>
            </article>
            {collectionSourceWarnings.length > 0 ? (
              <section className="collection-source-warning-panel" aria-labelledby="collection-source-warning-heading">
                <div>
                  <span className="tag warning">Review needed</span>
                  <h3 id="collection-source-warning-heading">Collection source mapping needs review</h3>
                  <p>FFXIV Collect returned acquisition types the portal does not recognize yet. Collection data still syncs, but guide and availability links may be incomplete until these are mapped.</p>
                </div>
                <div className="sync-run-panel">
                  {collectionSourceWarnings.map((warning) => (
                    <article key={warning.id} className="sync-run-card collection-source-warning-card">
                      <div className="sync-run-heading">
                        <div><h3>{warning.source_type}</h3><p>{warning.catalog_name} · {warning.affected_count} affected item{warning.affected_count === 1 ? "" : "s"}</p></div>
                        <span className="sync-status warning">unmapped</span>
                      </div>
                      {warning.example_items.length > 0 ? <p><strong>Examples:</strong> {warning.example_items.join(", ")}</p> : null}
                      <p>First seen {formatShortDateTime(warning.first_observed_at)} · Last seen {formatShortDateTime(warning.last_observed_at)}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="sync-run-panel">
              {syncRuns.length > 0 ? (
                syncRuns.map((run) => (
                  <article key={run.id} className="sync-run-card">
                    <div className="sync-run-heading">
                      <div>
                        <h3>{run.sync_type}</h3>
                        <p>
                          Started {formatShortDateTime(run.started_at)}
                          {run.finished_at ? ` · Finished ${formatShortDateTime(run.finished_at)}` : ""}
                        </p>
                      </div>

                      <span className={`sync-status ${run.status}`}>
                        {run.status}
                      </span>
                    </div>

                    <p>{run.message ?? "No message was recorded."}</p>
                  </article>
                ))
              ) : (
                <article className="panel">
                  <span className="tag">Waiting</span>
                  <h3>No sync runs yet</h3>
                  <p>
                    The worker has not written a sync record yet. Check the cotf-worker container log
                    if this stays empty after a minute.
                  </p>
                </article>
              )}
            </div>

            {/* ========================= */}

              </div>
            </details>

            {isAdmin ? (
            <details id="officer-backups" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary">
                <div><span className="tag">Admin</span><h3>Backup &amp; Recovery</h3><p>Create a complete migration archive in the installation&apos;s shared backups folder.</p></div>
                <span className="tracker-collapsible-toggle">Open</span>
              </summary>
              <div className="officer-tool-content portal-backup-panel">
                <div className="panel">
                  <h4>Portable portal backup</h4>
                  <p>The archive contains PostgreSQL data, the complete installation environment, every portal-owned persistent data folder, and a reference copy of the current Compose file. That includes branding, AnimeSchedule and Google Calendar credentials, Tailscale state, and Cloudflare and Authentik portal credentials.</p>
                  <p><strong>Saved on the Docker host:</strong> <code>backups/cotf-portal-backup-…tar.gz</code></p>
                  <p className="muted">The archive is not encrypted and contains passwords, tokens, member data, and private uploads. Move it to protected storage after creation.</p>
                  <LiveBackgroundAction
                    action={createPortableBackup}
                    statusAction={getOfficerBackgroundActionStatus}
                    statusKind="backup"
                    idleLabel={backupJobs.some((job) => job.status === "pending" || job.status === "running") ? "Backup in progress..." : "Create Backup Now"}
                    pendingLabel="Requesting backup..."
                    queuedLabel="Backup queued"
                    disabled={backupJobs.some((job) => job.status === "pending" || job.status === "running")}
                    watchForMs={120000}
                  />
                </div>
                <div className="portal-backup-history">
                  <div className="portal-backup-history-heading"><div><h4>Backup history</h4><p>Portal-requested jobs only. Clearing this list does not remove archive files.</p></div><ClearBackupHistoryButton action={clearBackupHistory} count={backupJobs.filter((job) => job.status === "completed" || job.status === "failed").length} /></div>
                  {backupJobs.length ? backupJobs.map((job) => (
                    <article className="portal-backup-row" key={job.id}>
                      <span className={`tag ${job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}`}>{job.status}</span>
                      <div><strong>{job.archiveName || `Backup request #${job.id}`}</strong><p>Requested {formatShortDateTime(job.requestedAt)} by {job.requestedBy}</p></div>
                      <div>{job.completedAt ? <span>Finished {formatShortDateTime(job.completedAt)}</span> : job.startedAt ? <span>Started {formatShortDateTime(job.startedAt)}</span> : <span>Waiting for the backup helper</span>}{job.archiveSizeBytes ? <small>{(job.archiveSizeBytes / 1024 / 1024).toFixed(1)} MB</small> : null}</div>
                      {job.errorText ? <p className="portal-backup-error">{job.errorText}</p> : null}
                    </article>
                  )) : <p>No site-requested backups have been recorded yet. Backups created with the included host scripts remain valid but do not appear in this history.</p>}
                </div>
              </div>
            </details>
            ) : null}

            {isAdmin ? (
            <details id="officer-privacy" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary"><span className="tag">Admin</span><h3>Legal &amp; Privacy</h3></summary>
              <div className="officer-tool-content"><p>Publish the installation&apos;s privacy contact and retention periods, preview or export a member&apos;s stored records, and process a verified erasure request.</p><div className="form-actions"><a className="button primary" href="/privacy/manage">Open Privacy Controls</a><a className="button secondary" href="/privacy" target="_blank" rel="noreferrer">View Public Policy</a></div></div>
            </details>
            ) : null}

            {isAdmin ? (
            <details id="officer-admin-settings" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary"><span className="tag">Admin</span><h3>Portal Administrators</h3></summary>
              <div className="officer-tool-content">
                <p>Manage additional administrators for direct Discord OAuth login. Changes apply to their portal session automatically; bot roles are not changed.</p>
                <div className="panel">
                  <h4>Primary setup administrator</h4>
                  <p>{primaryAdminDiscordIds.length ? primaryAdminDiscordIds.join(", ") : "None configured in the installation environment."}</p>
                  <small>The primary ID comes from the sealed installation and cannot be removed here. Setup-added secondary administrators appear below and can be removed.</small>
                </div>
                <form action={saveAdditionalPortalAdministrators} className="settings-form administrator-settings-form">
                  <h4>Additional Discord administrators</h4>
                  <AdministratorIdFields initialIds={settings.additionalAdminDiscordIds.split(",").map((value) => value.trim()).filter(Boolean)} />
                  <div className="form-actions"><button className="button primary" type="submit">Save Administrators</button></div>
                </form>
              </div>
            </details>
            ) : null}

            <details id="officer-portal-settings" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary"><span className="tag">✦</span><h3>Portal Settings</h3></summary>
              <div className="officer-tool-content">

            {/* SECTION: Portal Settings */}
            {/* ========================= */}

            <form action={savePortalSettings} className="settings-form">
              <div className="form-grid">
                <div className="panel full theme-settings-note">
                  <strong>Portal colors have moved to Editor Mode.</strong>
                  <small>Use the Editor Mode button in the page header, click the part of the site you want to change, preview a color, and save it.</small>
                </div>
                <input type="hidden" name="backgroundColor" value={settings.backgroundColor} />
                <input type="hidden" name="accentColor" value={settings.accentColor} />
                <input type="hidden" name="tileColor" value={settings.tileColor} />

                <label>
                  <span>Discord Invite URL</span>
                  <input
                    name="discordInviteUrl"
                    type="url"
                    defaultValue={settings.discordInviteUrl}
                    placeholder="https://discord.gg/your-invite"
                  />
                </label>

                <label className="full">
                  <span>Discord Invite Visibility</span>
                  <span className="toggle-row">
                    <input
                      name="discordInvitePublic"
                      type="checkbox"
                      defaultChecked={settings.discordInvitePublic}
                    />
                    Show the Discord invite publicly
                  </span>
                  <small>When off, the invite is visible only to signed-in current FC members and officers.</small>
                </label>

                <label>
                  <span>Free Company Lodestone URL</span>
                  <input
                    name="lodestoneUrl"
                    type="url"
                    defaultValue={settings.lodestoneUrl}
                    placeholder="https://na.finalfantasyxiv.com/lodestone/freecompany/..."
                  />
                </label>

                <label>
                  <span>Recruitment Lodestone URL</span>
                  <input
                    name="recruitmentLodestoneUrl"
                    type="url"
                    defaultValue={settings.recruitmentLodestoneUrl}
                    placeholder="https://na.finalfantasyxiv.com/lodestone/freecompany/.../recruitment/"
                  />
                  <small>Shown publicly as the Apply Now button on FC Information.</small>
                </label>

                <label>
                  <span>Direct Discord Contact URL</span>
                  <input
                    name="directDiscordContactUrl"
                    type="url"
                    defaultValue={settings.directDiscordContactUrl}
                    placeholder="https://discord.com/users/..."
                  />
                  <small>Shown publicly as Message Me on Discord. Leave blank to hide it.</small>
                </label>

                <label className="full">
                  <span>Homepage Welcome Text</span>
                  <textarea
                    name="welcomeText"
                    defaultValue={settings.welcomeText}
                    rows={4}
                  />
                </label>

                <label className="full">
                  <span>Announcement Text</span>
                  <textarea
                    name="announcementText"
                    defaultValue={settings.announcementText}
                    rows={4}
                  />
                </label>
                <label className="full">
                  <span>Raid Progression / Current Focus</span>
                  <textarea name="raidProgressionText" defaultValue={settings.raidProgressionText} rows={3} />
                </label>

                <label className="full">
                  <span>Raid Schedule</span>
                  <textarea name="raidScheduleText" defaultValue={settings.raidScheduleText} rows={2} />
                </label>

                <label className="full">
                  <span>Raid Expectations</span>
                  <textarea name="raidExpectationsText" defaultValue={settings.raidExpectationsText} rows={3} />
                </label>

                <label className="full">
                  <span>Raid Recruitment</span>
                  <textarea name="raidRecruitmentText" defaultValue={settings.raidRecruitmentText} rows={3} />
                </label>
              </div>

              <div className="form-actions">
                <button className="button primary" type="submit">
                  Save Portal Settings
                </button>
              </div>
            </form>

            {/* ========================= */}
              </div>
            </details>

            <details id="officer-mount-management" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary"><span className="tag">♞</span><h3>Mount Management</h3></summary>
              <div className="officer-tool-content">

            {/* SECTION: Mount Management */}
            {/* ========================= */}

            <div className="section-title-row">
              <div>
                <p className="eyebrow">Mount Catalog</p>
                <h2>Mount Management</h2>
                <p>
                  Override the worker classification. Active farm targets appear in the tracker;
                  ignored mounts are hidden from tracker totals and farm planning.
                </p>
              </div>
            </div>

            <form className="mount-management-filters" method="get" action="/#officer-mount-management">
              <input type="hidden" name="view" value="officers" />
              <label>
                <span>Search</span>
                <input
                  name="managedMountSearch"
                  defaultValue={managedMountFilters.search}
                  placeholder="Search mount, source, set, expansion..."
                />
              </label>

              <label>
                <span>Category</span>
                <select name="managedMountCategory" defaultValue={managedMountFilters.category}>
                  <option value="">All categories</option>
                  <option value="Trial">Trial</option>
                  <option value="Raid">Raid</option>
                  <option value="Dungeon">Dungeon</option><option value="Variant / Criterion">Variant / Criterion</option>
                  <option value="Achievement">Achievement</option>
                  <option value="Vendor / Currency">Vendor / Currency</option>
                  <option value="Premium">Premium</option>
                  <option value="Limited / Event">Limited / Event</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                <span>Farm Priority</span>
                <select name="managedMountPriority" defaultValue={managedMountFilters.farmPriority}>
                  <option value="">All priorities</option>
                  <option value="farm_target">Farm target</option>
                  <option value="optional">Optional</option>
                  <option value="ignore">Ignore</option>
                </select>
              </label>

              <label>
                <span>Visibility</span>
                <select name="managedMountVisibility" defaultValue={managedMountFilters.visibility}>
                  <option value="">Active and hidden</option>
                  <option value="active">Active only</option>
                  <option value="hidden">Hidden only</option>
                </select>
              </label>

              <label>
                <span>Override</span>
                <select name="managedMountOverride" defaultValue={managedMountFilters.overrideStatus}>
                  <option value="">Manual and auto</option>
                  <option value="manual">Manual override only</option>
                  <option value="auto">Auto classified only</option>
                </select>
              </label>

              <div className="mount-filter-actions">
                <button className="button primary" type="submit">
                  Apply Filters
                </button>

                <a className="ghost-button" href="/?view=officers#officer-mount-management">
                  Clear
                </a>
              </div>
            </form>

            <div className="mount-management-list">
              {managedMounts.length > 0 ? (
                managedMounts.map((mount) => (
                  <article key={mount.id} className="mount-management-card">
                    <div className="mount-management-heading">
                      <div>
                        <h3>{mount.mount_name}</h3>
                        <p>
                          {mount.expansion ?? "Unknown"} · {mount.set_name ?? "Unassigned"}
                          {mount.source_name ? ` · ${mount.source_name}` : ""}
                        </p>
                      </div>

                      <div className="character-meta">
                        <span>{mount.active ? "Active" : "Hidden"}</span>
                        <span>{mount.mount_category}</span>
                        <span>{mount.farm_priority}</span>
                        {mount.manual_override ? (
                          <span>Manual Override</span>
                        ) : (
                          <span>Auto Classified</span>
                        )}
                      </div>
                    </div>

                    <form action={updateMountSettings} className="mount-management-form">
                      <input type="hidden" name="mountId" value={mount.id} />

                      <label>
                        <span>Category</span>
                        <select name="mountCategory" defaultValue={mount.mount_category}>
                          <option value="Trial">Trial</option>
                          <option value="Raid">Raid</option>
                          <option value="Dungeon">Dungeon</option><option value="Variant / Criterion">Variant / Criterion</option>
                          <option value="Achievement">Achievement</option>
                          <option value="Vendor / Currency">Vendor / Currency</option>
                          <option value="Premium">Premium</option>
                          <option value="Limited / Event">Limited / Event</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>

                      <label>
                        <span>Farm Priority</span>
                        <select name="farmPriority" defaultValue={mount.farm_priority}>
                          <option value="farm_target">Farm target</option>
                          <option value="optional">Optional</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </label>

                      <label className="mount-active-toggle">
                        <span>Tracker Visibility</span>
                        <span className="toggle-row">
                          <input name="active" type="checkbox" defaultChecked={mount.active} />
                          Show in tracker
                        </span>
                      </label>

                      <button className="button primary" type="submit">
                        Save Mount
                      </button>
                    </form>
                  </article>
                ))
              ) : (
                <article className="panel">
                  <span className="tag">Waiting</span>
                  <h3>No mounts loaded yet</h3>
                  <p>
                    Mounts will appear here after the worker completes a mount-catalog-sync.
                  </p>
                </article>
              )}
            </div>

            {/* ========================= */}
              </div>
            </details>

            <details id="officer-role-settings" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary"><span className="tag">♜</span><h3>Roles</h3></summary>
              <div className="officer-tool-content">

            {/* SECTION: Roles */}
            {/* ========================= */}

            <div className="section-title-row">
              <div>
                <p className="eyebrow">Roles</p>
                <h2>Character Roles</h2>
                <p>
                  These roles control the character-management dropdown. They are separate from
                  Authentik login groups.
                </p>
              </div>
            </div>

            <div className="role-manager">
              <form action={saveRole} className="role-form">
                <input name="roleName" type="text" placeholder="New role name" />
                <input name="sortOrder" type="number" placeholder="Sort order" defaultValue="100" />
                <button className="button primary" type="submit">
                  Add / Update Role
                </button>
              </form>

              <div className="role-list">
                {roles.map((role) => (
                  <div key={role.name} className="role-row">
                    <div>
                      <strong>{role.name}</strong>
                      <span>Sort {role.sort_order}</span>
                    </div>

                    {role.name !== "Member" ? (
                      <form action={deleteRole}>
                        <input type="hidden" name="roleName" value={role.name} />
                        <button className="top-action-button" type="submit">
                          Remove
                        </button>
                      </form>
                    ) : (
                      <span className="role-lock">Required</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ========================= */}
              </div>
            </details>

            <details id="officer-character-manager" className="tracker-collapsible officer-tool-card">
              <summary className="tracker-collapsible-summary"><span className="tag">♢</span><h3>Character Management</h3></summary>
              <div className="officer-tool-content">

            {/* SECTION: Add Character */}
            {/* ========================= */}

            <div className="section-title-row">
              <div>
                <p className="eyebrow">Characters</p>
                <h2>Character Management</h2>
                <p>
                  Add Free Company characters here. Display name is locked to character name,
                  and world is locked to {defaultWorld}.
                </p>
              </div>
            </div>

            <form action={saveCharacter} className="settings-form">
              <div className="form-grid">
                <label>
                  <span>Character Name</span>
                  <input
                    name="characterName"
                    type="text"
                    required
                    placeholder="Character Firstname Lastname"
                  />
                </label>

                <label>
                  <span>World</span>
                  <input
                    type="text"
                    value={defaultWorld}
                    readOnly
                  />
                </label>

                <label>
                  <span>Lodestone Character ID</span>
                  <input
                    name="lodestoneCharacterId"
                    type="text"
                    placeholder="Optional for now"
                  />
                </label>

                <label>
                  <span>FFXIV Collect Character ID</span>
                  <input
                    name="ffxivCollectCharacterId"
                    type="text"
                    placeholder="Optional for now"
                  />
                </label>

                <label>
                  <span>Linked Authentik Email</span>
                  <input
                    name="authentikEmail"
                    type="email"
                    placeholder="Optional, example: member@email.com"
                  />
                </label>

                <label>
                  <span>Role</span>
                  <select name="role" defaultValue="Member">
                    {roles.map((role) => (
                      <option key={role.name} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full">
                  <span>Notes</span>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Optional notes for officers"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="button primary" type="submit">
                  Add Character
                </button>
              </div>
            </form>

            {/* ========================= */}
            {/* SECTION: Character Filters */}
            {/* ========================= */}

            <LiveCharacterFilters roles={roles} total={characters.length} initialQuery={getSearchParam("characterSearch")} initialRole={getSearchParam("roleFilter")} initialStatus={getSearchParam("statusFilter")} />

            {/* ========================= */}
            {/* SECTION: Character List */}
            {/* ========================= */}

            <div className="character-list compact">
              {characters.length > 0 ? (
                characters.map((character) => (
                  <details
                    key={character.id}
                    className="character-card character-collapsible"
                    data-character-filter-card
                    data-character-search={[character.display_name, character.character_name, character.authentik_email, character.lodestone_character_id, character.ffxiv_collect_character_id, character.world].filter(Boolean).join(" ")}
                    data-character-role={character.role}
                    data-character-status={character.active ? "active" : "inactive"}
                  >
                    <summary className="character-summary">
                      <div>
                        <h3>{character.display_name}</h3>
                        <p>
                          {character.character_name} · {character.world}
                        </p>
                      </div>

                      <div className="character-meta">
                        <span>{character.role}</span>
                        <span>{character.active ? "Active" : "Inactive"}</span>
                        <span>FC {character.fc_membership_status}</span>
                        <span>Sync {character.sync_status}</span>
                        {character.linked_character_count > 0 ? <span>+{character.linked_character_count} linked character{character.linked_character_count === 1 ? "" : "s"}</span> : null}
                         <span>{character.mount_win_notifications_enabled ? "Mount wins on" : "Mount wins muted"}</span>
                        {character.lodestone_character_id ? (
                          <span>Lodestone {character.lodestone_character_id}</span>
                        ) : null}
                        {character.ffxiv_collect_character_id ? (
                          <span>Collect {character.ffxiv_collect_character_id}</span>
                        ) : null}
                        <span className="edit-chip">Edit</span>
                      </div>
                    </summary>

                    <form action={updateCharacter} className="character-edit-form">
                      <input type="hidden" name="characterId" value={character.id} />

                      <div className="form-grid">
                        <label>
                          <span>Character Name</span>
                          <input
                            name="characterName"
                            type="text"
                            required
                            defaultValue={character.character_name}
                          />
                        </label>

                        <label>
                          <span>World</span>
                          <input type="text" value={defaultWorld} readOnly />
                        </label>

                        <label>
                          <span>Lodestone Character ID</span>
                          <input
                            name="lodestoneCharacterId"
                            type="text"
                            defaultValue={character.lodestone_character_id ?? ""}
                          />
                        </label>

                        <label>
                          <span>FFXIV Collect Character ID</span>
                          <input
                            name="ffxivCollectCharacterId"
                            type="text"
                            defaultValue={character.ffxiv_collect_character_id ?? ""}
                          />
                        </label>

                        <label>
                          <span>Linked Authentik Email</span>
                          <input
                            name="authentikEmail"
                            type="email"
                            defaultValue={character.authentik_email ?? ""}
                          />
                        </label>

                        <label>
                          <span>Role</span>
                          <select name="role" defaultValue={character.role}>
                            {roles.map((role) => (
                              <option key={role.name} value={role.name}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="character-active-toggle">
                          <span>Character Status</span>
                          <span className="toggle-row">
                            <input
                              name="active"
                              type="checkbox"
                              defaultChecked={character.active}
                            />
                            Active
                          </span>
                        </label>

                        <label className="character-active-toggle">
                          <span>Mount Win Notifications</span>
                          <span className="toggle-row">
                            <input
                              name="mountWinNotificationsEnabled"
                              type="checkbox"
                              defaultChecked={character.mount_win_notifications_enabled}
                            />
                            Include this character in Discord mount-win congratulations
                          </span>
                        </label>
                        <label className="full">
                          <span>Notes</span>
                          <textarea
                            name="notes"
                            rows={3}
                            defaultValue={character.notes ?? ""}
                          />
                        </label>
                      </div>

                      <div className="form-actions">
                        <button className="button primary" type="submit">
                          Save Changes
                        </button>
                      </div>
                    </form>

                    <form action={deleteCharacter} className="danger-form">
                      <input type="hidden" name="characterId" value={character.id} />
                      <button className="danger-button" type="submit">
                        Remove Character
                      </button>
                    </form>
                  </details>
                ))
              ) : (
                <article className="panel">
                  <span className="tag">Empty</span>
                  <h3>No characters found</h3>
                  <p>Add a character above or adjust your filters.</p>
                </article>
              )}
            </div>

              </div>
            </details>
          </section>
        ) : null}
      </section>
      <footer className="legal-footer"><p>This independent community portal is not affiliated with or endorsed by Square Enix.</p><p><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/legal">Legal &amp; Content Notice</a></p></footer>
    </main>
  );
}

