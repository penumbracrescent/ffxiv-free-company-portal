"use client";

import { type ReactNode, useMemo, useState } from "react";

type GalleryPost = { id: number; contributor: string; card: ReactNode; };
type CommunityGalleryBrowserProps = { posts: GalleryPost[]; };
const contributorKey = (name: string) => name.trim().toLocaleLowerCase();

export default function CommunityGalleryBrowser({ posts }: CommunityGalleryBrowserProps) {
  const [selectedContributor, setSelectedContributor] = useState("");
  const contributors = useMemo(() => {
    const names = new Map<string, string>();
    for (const post of posts) {
      const name = post.contributor.trim();
      if (name) names.set(contributorKey(name), name);
    }
    return [...names.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
  }, [posts]);
  const contributorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      const key = contributorKey(post.contributor);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [posts]);
  const visiblePosts = selectedContributor
    ? posts.filter((post) => contributorKey(post.contributor) === selectedContributor)
    : posts;

  return (
    <>
      <div className="community-gallery-contributor-filter">
        <label htmlFor="gallery-contributor-filter">Filter by contributor</label>
        <select id="gallery-contributor-filter" value={selectedContributor} onChange={(event) => setSelectedContributor(event.target.value)}>
          <option value="">All contributors ({posts.length} posts)</option>
          {contributors.map((contributor) => (
            <option key={contributor.key} value={contributor.key}>
              {contributor.label} ({contributorCounts.get(contributor.key) ?? 0})
            </option>
          ))}
        </select>
        <span aria-live="polite">Showing {visiblePosts.length} of {posts.length} post{posts.length === 1 ? "" : "s"}</span>
      </div>
      <div className="community-gallery-grid">
        {visiblePosts.map((post) => <div key={post.id} className="community-gallery-filtered-post">{post.card}</div>)}
      </div>
    </>
  );
}