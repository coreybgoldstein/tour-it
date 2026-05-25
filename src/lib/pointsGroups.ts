/**
 * Single source of truth for the "How Points Work" breakdown.
 *
 * Used by:
 *   - MayCompetitionModal — the monthly-competition modal that
 *     includes the prize / how-to-win / how-points-work / tie-
 *     breaker sections.
 *   - PointsSystemSheet — the generic, evergreen "How Points
 *     Work" sheet that lives on /leaderboards and is the
 *     destination for first-earn celebrations.
 *
 * Both UIs pull from the same POINT_VALUES enum so the displayed
 * numbers never drift from what awardPoints() actually awards.
 */

import { POINT_VALUES, PointAction } from "@/config/points-system";

export type PointsRow = { label: string; display: string; negative?: boolean };
export type PointsGroup = { title: string; rows: PointsRow[] };

const fmt = (n: number) => `+${n} pts`;
const fmtNeg = (n: number) => `${n} pts`;

export const POINTS_GROUPS: PointsGroup[] = [
  {
    title: "Content & Uploads",
    rows: [
      { label: "Upload a clip",                          display: fmt(POINT_VALUES[PointAction.UPLOAD_CLIP]) },
      { label: "First clip ever at a course (bonus)",    display: fmt(POINT_VALUES[PointAction.UPLOAD_FIRST_FOR_COURSE]) },
      { label: "Upload a full-hole series",              display: fmt(POINT_VALUES[PointAction.UPLOAD_SERIES]) },
      { label: "Intel quality bonus (club, wind, note)", display: "+4 to +10 pts" },
      { label: "Add a hole photo",                       display: fmt(POINT_VALUES[PointAction.ADD_HOLE_PHOTO]) },
    ],
  },
  {
    title: "Course Data Contribution",
    rows: [
      { label: "Add a course cover photo",        display: fmt(POINT_VALUES[PointAction.ADD_COVER_PHOTO]) },
      { label: "Add a course logo",               display: fmt(POINT_VALUES[PointAction.ADD_COURSE_LOGO]) },
      { label: "Write a course description",      display: fmt(POINT_VALUES[PointAction.ADD_COURSE_DESCRIPTION]) },
      { label: "Add year established",            display: fmt(POINT_VALUES[PointAction.ADD_YEAR_ESTABLISHED]) },
      { label: "Add website URL",                 display: fmt(POINT_VALUES[PointAction.ADD_WEBSITE_URL]) },
      { label: "Add course type",                 display: fmt(POINT_VALUES[PointAction.ADD_COURSE_TYPE]) },
      { label: "Add zip code",                    display: fmt(POINT_VALUES[PointAction.ADD_ZIP_CODE]) },
      { label: "Complete a course's full profile (bonus)", display: fmt(POINT_VALUES[PointAction.COURSE_PROFILE_COMPLETE]) },
    ],
  },
  {
    title: "Scorecard & Rounds",
    rows: [
      { label: "Add hole par",                        display: fmt(POINT_VALUES[PointAction.ADD_HOLE_PAR]) },
      { label: "Add hole yardage",                    display: fmt(POINT_VALUES[PointAction.ADD_HOLE_YARDAGE]) },
      { label: "Complete a scorecard",                display: fmt(POINT_VALUES[PointAction.SCORECARD_COMPLETE]) },
      { label: "First scorecard for a course",        display: fmt(POINT_VALUES[PointAction.FIRST_SCORECARD_FOR_COURSE]) },
      { label: "Log your first round (one-time)",     display: fmt(POINT_VALUES[PointAction.LOG_FIRST_ROUND]) },
      { label: "Log a complete round",                display: fmt(POINT_VALUES[PointAction.LOG_COMPLETE_ROUND]) },
    ],
  },
  {
    title: "Social",
    rows: [
      { label: "Like received on your clip",       display: fmt(POINT_VALUES[PointAction.LIKE_RECEIVED]) },
      { label: "Comment received on your clip",    display: fmt(POINT_VALUES[PointAction.COMMENT_RECEIVED]) },
      { label: "New follower",                     display: fmt(POINT_VALUES[PointAction.FOLLOW_RECEIVED]) },
    ],
  },
  {
    title: "Onboarding (one-time)",
    rows: [
      { label: "Sign up",                          display: fmt(POINT_VALUES[PointAction.SIGNUP]) },
      { label: "Complete your profile",            display: fmt(POINT_VALUES[PointAction.COMPLETE_PROFILE]) },
      { label: "Enable push notifications",        display: fmt(POINT_VALUES[PointAction.ENABLE_NOTIFICATIONS]) },
    ],
  },
  {
    title: "Like Milestones (one-time)",
    rows: [
      { label: "10 total likes received",          display: fmt(POINT_VALUES[PointAction.MILESTONE_10_LIKES]) },
      { label: "100 total likes received",         display: fmt(POINT_VALUES[PointAction.MILESTONE_100_LIKES]) },
      { label: "1,000 total likes received",       display: fmt(POINT_VALUES[PointAction.MILESTONE_1000_LIKES]) },
    ],
  },
  {
    title: "Upload Streaks (one-time)",
    rows: [
      { label: "3-week streak",   display: fmt(POINT_VALUES[PointAction.STREAK_3_WEEKS]) },
      { label: "8-week streak",   display: fmt(POINT_VALUES[PointAction.STREAK_8_WEEKS]) },
      { label: "12-week streak",  display: fmt(POINT_VALUES[PointAction.STREAK_12_WEEKS]) },
      { label: "26-week streak",  display: fmt(POINT_VALUES[PointAction.STREAK_26_WEEKS]) },
      { label: "52-week streak",  display: fmt(POINT_VALUES[PointAction.STREAK_52_WEEKS]) },
    ],
  },
  {
    title: "Referrals",
    rows: [
      { label: "Friend signs up with your link",       display: fmt(POINT_VALUES[PointAction.REFERRAL_SIGNUP]) },
      { label: "Friend posts their first clip",        display: fmt(POINT_VALUES[PointAction.REFERRAL_FIRST_UPLOAD]) },
    ],
  },
  {
    title: "Trips & Games",
    rows: [
      { label: "Create a trip",                                  display: fmt(POINT_VALUES[PointAction.CREATE_TRIP]) },
      { label: "Create a game inside a trip",                    display: fmt(POINT_VALUES[PointAction.CREATE_GAME]) },
      { label: "Turn a trip into a Ryder Cup (one-time per trip)", display: fmt(POINT_VALUES[PointAction.ENABLE_RYDER_CUP]) },
    ],
  },
  {
    title: "Progression",
    rows: [
      { label: "Level up",                              display: fmt(POINT_VALUES[PointAction.LEVEL_UP]) },
      { label: "Rank promotion (LOCAL → LEGEND)",       display: "+100 to +1,000 pts" },
    ],
  },
  {
    title: "Deductions",
    rows: [
      { label: "Like removed from your clip",  display: fmtNeg(POINT_VALUES[PointAction.UNLIKE_RECEIVED]),  negative: true },
      { label: "Clip deleted",                 display: fmtNeg(POINT_VALUES[PointAction.UPLOAD_DELETED]),   negative: true },
      { label: "Trip deleted",                 display: fmtNeg(POINT_VALUES[PointAction.TRIP_DELETED]),     negative: true },
      { label: "Game deleted",                 display: fmtNeg(POINT_VALUES[PointAction.GAME_DELETED]),     negative: true },
      { label: "Round deleted",                display: fmtNeg(POINT_VALUES[PointAction.ROUND_DELETED]),    negative: true },
    ],
  },
];
