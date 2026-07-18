# Atlas

Atlas is an independent, privacy-conscious onboarding chatbot prototype. It demonstrates how a small, locally stored knowledge base can support grounded orientation in a member-based community.

> Atlas is a personal demonstration project. It is not affiliated with, endorsed by, or operated by any organization referenced in its example content.

## Public repository scope

This repository deliberately contains:

- no copy or mirror of the Mensa website
- no member or contact directory
- no private telephone numbers, email addresses, or account details
- no internal Mensa documents or internal service links
- no API keys or production credentials
- no official Mensa logo or other official brand asset

The Markdown files in `data/knowledge` are short, independently written demo content. Links point readers to official public pages for current and binding information.

## Start locally

Requires Node.js 20 or newer.

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Optional language-model integration

Create a local `.env` file based on `.env.example` and provide your own credentials:

```text
SAIA_API_KEY=your_api_key
SAIA_BASE_URL=https://chat-ai.academiccloud.de/v1
SAIA_MODEL=mistral-large-3-675b-instruct-2512
```

Atlas searches the local knowledge base first and sends only the question, recent conversation context, and retrieved source excerpts to a configured endpoint. Without an external model, it falls back to local retrieval mode.

## Privacy defaults

- No external analytics.
- Chat transcripts are not stored unless `LOG_CHAT_TRANSCRIPTS=true` is set deliberately.
- Runtime files are written to `data/runtime` locally or `/tmp` on Vercel and are excluded from Git.
- Feedback email delivery is disabled unless the required environment variables are configured.
- Secrets belong in `.env` or the hosting provider's environment settings, never in Git.

## Knowledge base

The demo knowledge lives in `data/knowledge`. Replace or extend it only with content you wrote yourself, content covered by a compatible license, or content you have explicit permission to redistribute.

For a production deployment, use reviewed and approved information, define content ownership, and document privacy, retention, and escalation policies.

## API

- `GET /api/health`
- `GET /api/sources`
- `POST /api/chat`
- `POST /api/feedback`
- `POST /api/reload`

## License

The original source code and demo content in this repository are available under the MIT License. Third-party names and linked websites remain the property of their respective owners.
