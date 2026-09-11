// Trusted API fixtures for the older routing/state tests. Adversarial tests
// exercise the real verifier with independently controlled API responses.
export const repository = "example-org/example-repo";
export const token = "ghs_fixture";
export function authorityFetch(payload, eventName, fallback) {
  const feedback = eventName === "pull_request_review" ? payload.review : payload.comment;
  const root = `https://api.github.com/repos/${repository}`;
  const number = (payload.pull_request || payload.issue)?.number;
  return async (url, options) => {
    if (url.includes("/collaborators/")) return new Response(JSON.stringify({ permission: "write", user: feedback.user }));
    if (url.includes("/reviews/") || /\/(issues|pulls)\/comments\//.test(url)) {
      return new Response(JSON.stringify({ ...feedback,
        issue_url: `${root}/issues/${number}`, pull_request_url: `${root}/pulls/${number}` }));
    }
    return fallback(url, options);
  };
}
