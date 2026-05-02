export type EarnedBadge = {
  id: string;
  awardedAt: string;
  badge: {
    slug: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
  };
};
