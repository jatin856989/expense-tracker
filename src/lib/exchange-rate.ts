/**
 * Free, no-key exchange-rate lookup shared by the portfolio-screenshot
 * importer and the live price refresh — rates barely move within an hour,
 * so the fetch is cached that long.
 */
export async function fetchInrRate(currencyCode: string): Promise<number | null> {
  if (currencyCode === "INR") return 1;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currencyCode)}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const rate = json?.rates?.INR;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}
