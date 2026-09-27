export type SearchableCraftingCatalogItem = {
  id: number;
  name: string;
  category: string | null;
  level: number | null;
  itemLevel: number | null;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

// Damerau-Levenshtein treats a common adjacent-key transposition as one typo.
function editDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distance[row][0] = row;
  for (let column = 0; column < columns; column += 1) distance[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + cost
      );
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        distance[row][column] = Math.min(distance[row][column], distance[row - 2][column - 2] + cost);
      }
    }
  }
  return distance[left.length][right.length];
}

function wordSimilarity(queryWord: string, itemWord: string) {
  if (queryWord === itemWord) return 1;
  if (itemWord.includes(queryWord) || queryWord.includes(itemWord)) {
    return 0.9 + (Math.min(queryWord.length, itemWord.length) / Math.max(queryWord.length, itemWord.length)) * 0.09;
  }
  return 1 - editDistance(queryWord, itemWord) / Math.max(queryWord.length, itemWord.length, 1);
}

function minimumWordSimilarity(length: number) {
  if (length <= 3) return 0.8;
  if (length <= 5) return 0.66;
  return 0.58;
}

function scoreName(rawQuery: string, rawName: string) {
  const query = normalize(rawQuery);
  const name = normalize(rawName);
  if (!query || !name) return null;
  if (name === query) return 5000;
  if (name.startsWith(query)) return 4500 - name.length;
  if (name.includes(query)) return 4200 - name.indexOf(query) - name.length / 100;

  const queryWords = query.split(" ");
  const itemWords = name.split(" ");
  const similarities = queryWords.map((queryWord) => Math.max(...itemWords.map((itemWord) => wordSimilarity(queryWord, itemWord))));
  const matched = similarities.filter((similarity, index) => similarity >= minimumWordSimilarity(queryWords[index].length)).length;
  const requiredMatches = queryWords.length === 1 ? 1 : Math.max(1, Math.ceil(queryWords.length * 0.6));
  if (matched < requiredMatches) return null;

  const average = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
  const coverage = matched / queryWords.length;
  return coverage * 1800 + average * 1200 - Math.abs(name.length - query.length) * 0.5;
}

export function rankCraftingCatalogItems<T extends SearchableCraftingCatalogItem>(items: T[], rawQuery: string, limit = 30): T[] {
  return items
    .map((item) => ({ item, score: scoreName(rawQuery, item.name) }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score
      || (left.item.level ?? Number.MAX_SAFE_INTEGER) - (right.item.level ?? Number.MAX_SAFE_INTEGER)
      || left.item.name.localeCompare(right.item.name))
    .slice(0, limit)
    .map((entry) => entry.item);
}
