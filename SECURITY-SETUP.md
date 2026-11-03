# Security setup: the settings only Khaja can change

The code and workflows in this repo do their part; these settings in GitHub and Cloudflare complete it. Do them in order, once.
Use only the OpenOrbia accounts (the openorbia GitHub account and the personal Cloudflare account), never an employer's.

## 1. Accounts
- [ ] GitHub (openorbia): Settings → Password and authentication → two-factor authentication on, ideally with a passkey or security key.
- [ ] Cloudflare: My Profile → Authentication → two-factor authentication on.
- [ ] Brevo: two-factor authentication on.
- [ ] Email account that receives launch@openorbia.com: two-factor authentication on (it can reset all of the above).

## 2. Cloudflare API token for GitHub Actions
- [ ] Cloudflare → My Profile → API Tokens → Create token → Custom token:
  - Permissions: **Account → Cloudflare Pages → Edit**
  - Account resources: **Include → the OpenOrbia account only**
  - TTL: an end date about 6 months out (put a reminder in your calendar to replace it)
  If the first deploy fails with a D1 permission error, edit the token and add **Account → D1 → Edit**. Add nothing else.
- [ ] GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:
  - `CLOUDFLARE_API_TOKEN`: the token above
  - `CLOUDFLARE_ACCOUNT_ID`: from the Cloudflare dashboard (Workers & Pages → Account details)
- [ ] Revoke any older, broader Cloudflare tokens you no longer use, including any left in a computer's environment variables.

## 3. GitHub environments (deploy approvals)
- [ ] Settings → Environments → New environment `production`:
  - Required reviewers: **openorbia** (you). Nothing reaches openorbia.com until you click Approve.
  - Deployment branches and tags: **Selected branches → main** only.
- [ ] Settings → Environments → New environment `preview` (no reviewers needed).

## 4. Protect main
Settings → Rules → Rulesets → New branch ruleset, target **main**, enforcement **Active**:
- [ ] Restrict deletions; Block force pushes
- [ ] Require a pull request before merging (required approvals: **0**, since you are the only maintainer and GitHub does not let you approve your own pull request)
- [ ] Require status checks to pass: **Tests**, **Secret scan**, **Analyze JavaScript**; also "Require branches to be up to date"
- [ ] Bypass list: leave empty (or add only yourself, for emergencies)

Result: no person or agent can push to main directly, and every change runs the tests, the secret scan and CodeQL first.

## 5. GitHub security features (free on public repos)
Settings → Advanced Security (or "Code security"):
- [ ] Private vulnerability reporting: **Enable** (SECURITY.md points people to it)
- [ ] Dependabot alerts: **Enable**; Dependabot security updates: **Enable**
- [ ] Secret scanning: **Enable**; Push protection: **Enable** (blocks a push that contains a known key format)
- [ ] Code scanning: leave as is; the CodeQL workflow in this repo runs it

Settings → Actions → General:
- [ ] Workflow permissions: **Read repository contents** (the workflows ask for more only where needed)
- [ ] Turn off "Allow GitHub Actions to create and approve pull requests"
- [ ] Fork pull request workflows: **Require approval for all outside collaborators**

## 6. Agents
- [ ] Give agents a fine-grained GitHub token for **this repo only**, with Contents: Read and write and Pull requests: Read and write, and an expiry. Never an account-wide token, and never the Cloudflare token.
- [ ] Agents work on branches and open pull requests; the ruleset in step 4 stops them from reaching main, and step 3 stops them from reaching production.

## 7. After the first deploy through GitHub
- [ ] Open the preview link on the pull request and check: the homepage loads with its fonts, the waitlist Turnstile check appears when needed, the Launch List filters work, a launch page loads, and the browser console shows no "Content Security Policy" errors.
- [ ] Optional: check the headers at https://securityheaders.com/?q=openorbia.com
- [ ] Only after a few weeks with no problems, consider HSTS preload (hard to undo, so it is not on by default).
