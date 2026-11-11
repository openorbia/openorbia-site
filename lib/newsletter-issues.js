// Orbia Weekly issues, newest first. Adding an issue is a content edit here, not new code.
//
// An issue with `published: true` is a draft: it is not on /newsletter/, has no page and is not in the sitemap. Set it to true
// only when the founder says so. A published issue needs a real https source link on every news item (test/newsletter.test.js).
// News items are written in our own words; the picks are Launch List tools, checked against their docs, not "Tested by OpenOrbia".
//
// issue: { slug, date (YYYY-MM-DD), title, summary, published, news: [{ headline, text, source: { label, url } }],
//          picks: [{ slug (a Launch List tool), line }], catch }

export const ISSUES = [
  {
    slug: '2026-11-11',
    date: '2026-11-11',
    title: 'Free AI tools, in a week of big AI money',
    summary: "Anthropic's planned IPO price range, a coding app's cloud shutting down, three open-model releases with very different licenses, and three free tools that need nothing paid.",
    published: true,
    news: [
      { headline: 'Anthropic plans to offer 825 million shares at $70 to $78 each', text: 'It plans to price the shares on November 18 and start trading the next day. At the top of the range, that would value the company at up to $1.405 trillion on a fully diluted basis.', source: { label: 'CNBC', url: 'https://www.cnbc.com/2026/11/10/anthropic-ipo-revenue-growth-cramer.html' } },
      { headline: 'Conductor cloud shuts on November 20', text: 'Meta acquired the AI coding startup, whose app runs several coding agents at once. The cloud service goes read-only on November 13 and shuts on November 20, so export your data or move cloud workspaces to your own machine before then. This is why every listing here says where your data lives.', source: { label: 'SiliconANGLE', url: 'https://siliconangle.com/2026/11/04/meta-acquires-ai-coding-startup-conductor-whose-app-runs-several-coding-agents-at-once/' } },
      { headline: "PLaMo 3 Translate runs offline in 53 languages", text: "Preferred Networks released four translation models (0.8B to 31B parameters) that run on a laptop, phone or your own server without an internet connection. Commercial use is free for organizations under about 1 billion yen in annual revenue; larger ones need a commercial license. Check the license text for the exact boundary.", source: { label: "Preferred Networks", url: "https://www.preferred.jp/en/news/pr20261105" } },
      { headline: "Ripple-65B Preview is open under Apache 2.0, but it is big", text: "The model card lists a dense 65-billion-parameter model with up to about a million tokens of context under Apache 2.0. At that size it needs far more memory than a typical laptop, so treat it as one for a server or workstation.", source: { label: "Hugging Face model card", url: "https://huggingface.co/ricursiveAI/Ripple-65B-Preview" } },
      { headline: "Open weights are not always free for everyone: ERNIE-5.5-Flash-Base", text: "Baidu's license allows commercial use at or below US$50 million in related annual revenue, with a one-time notice to Baidu and a \"Powered by ERNIE\" credit. It covers everywhere except the EU, the UK and South Korea. Above the threshold you need Baidu's written authorization first.", source: { label: "Baidu's license", url: "https://huggingface.co/baidu/ERNIE-5.5-Flash-Base/blob/main/LICENSE" } },
    ],
    picks: [
      { slug: 'ollama', line: 'Run open AI models on your own computer. Free and unlimited for local models.' },
      { slug: 'jan', line: 'A free desktop app with offline local models.' },
      { slug: 'anythingllm', line: 'Ask questions about your own documents using a model that runs on your computer.' },
    ],
    catch: 'Local models need decent hardware, and AnythingLLM\'s multi-user mode needs its Docker version.',
  },
];
