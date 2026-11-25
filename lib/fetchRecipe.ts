import { fromHtml, type ImportedRecipe } from './recipeImport';

export type FetchResult =
  | { status: 'recipe'; recipe: ImportedRecipe }
  /** The page opened but holds no recipe we can read. */
  | { status: 'none' }
  /** The site refuses plain downloads, or needs scripts. A browser may still open it. */
  | { status: 'blocked' }
  | { status: 'offline' };

const MAX_LENGTH = 8_000_000;

export async function fetchRecipe(url: string): Promise<FetchResult> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 20_000);
  let response: Response;
  let html: string;
  try {
    response = await fetch(url, { headers: { Accept: 'text/html' }, signal: stop.signal });
    if (Number(response.headers.get('content-length') ?? 0) > MAX_LENGTH) return { status: 'none' };
    html = await response.text();
  } catch {
    return { status: stop.signal.aborted ? 'blocked' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
  const recipe = html.length <= MAX_LENGTH ? fromHtml(html, url) : null;
  if (recipe) return { status: 'recipe', recipe };
  if (response.status === 404 || response.status === 410) return { status: 'none' };
  return { status: response.ok ? 'none' : 'blocked' };
}
