*This project has been created as part of the 42 curriculum by samamg.*

# ft_transcendence - Transcendence

## Description

Transcendence is a full-stack web application built for the 42 Common Core final project.
It combines a real-time Pong game, social interactions, and profile management into a single responsive platform.

Primary goals:
- Deliver a production-like web architecture (frontend, backend, database).
- Provide multi-user real-time gameplay and chat.
- Implement secure authentication and persistent user data.
- Demonstrate coherent module choices worth at least 14 points.

Key features:
- Secure account system (register, login, session, logout, account deletion).
- Profile management (username, display name, avatar upload).
- Social features (friends, blocks, private/group chat, reactions, read receipts, notifications).
- Pong modes (local, practice vs AI, online authoritative multiplayer).
- Online history and profile statistics.
- Tournament module (4-player single elimination with bracket progression).

## Instructions

### Prerequisites

- Node.js 22+
- npm 10+
- Podman + podman-compose (or Docker + docker compose)
- PostgreSQL (only if running backend outside compose stack)

### Environment setup (local backend mode)

1. Copy environment file:

```bash
cp backend/.env.example backend/.env
```

2. Edit secrets if needed:
- `SESSION_SECRET` must be random in non-demo environments.

### Run in development (current workflow)

```bash
make dev
```

This command:
- Starts PostgreSQL container.
- Applies Prisma migrations.
- Starts backend and frontend dev servers.

Local URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

### Run full containerized stack (single command, HTTPS entrypoint)

```bash
docker compose up --build
```

or with podman-compose:

```bash
podman-compose up --build
```

Public entrypoint:
- `https://localhost:8443`

Notes:
- A local self-signed certificate is generated inside the frontend container.
- Browser may show a local certificate warning on first access.

### Validation / quality checks

```bash
make check
```

This includes:
- Database readiness
- Prisma generation + migration status
- Backend build
- Frontend build
- Frontend lint
- Socket.IO integration checks

## Team Information

Project executed solo:

- **samamg**
	- Roles: Product Owner, Project Manager, Technical Lead, Developer
	- Responsibilities:
		- Product scope and feature prioritization
		- Planning and delivery sequencing
		- Architecture and code quality decisions
		- Full-stack implementation and integration testing

## Project Management

- Work organization:
	- Feature-based iterative milestones (auth, social, game, stats, tournament).
	- Mandatory part stabilized first, modules finalized after baseline stability.
- Tracking:
	- Git commits with topic-focused changes.
	- Continuous verification with `make check`.
- Communication channel:
	- Solo workflow, no external team channel.

## Technical Stack

- Frontend:
	- React + TypeScript + Vite
- Backend:
	- Express + TypeScript + Socket.IO
- Database:
	- PostgreSQL
- ORM:
	- Prisma
- Session/auth:
	- `express-session` + PostgreSQL session store
	- Password hashing with `bcryptjs`
- Uploads:
	- `multer` for avatars
- Containerization:
	- Docker/Podman Compose
	- Front HTTPS termination via Nginx reverse proxy

Major technical choices:
- **Authoritative online game server** to prevent client-side cheating and race issues.
- **Prisma ORM** for relational consistency and migration control.
- **Socket.IO** for reliable event-based real-time interactions.

## Database Schema

Main entities and relationships:

- `User`
	- Core account and profile data.
- Social graph:
	- `FriendRequest`, `Friend`, `UserBlock`
- Chat:
	- `Conversation`, `ConversationParticipant`, `Message`, `MessageReaction`
- Match history:
	- `Match` (online authoritative results)
	- `GameMatch` (additional game history model)
- Session storage:
	- `Session` table for authenticated persistence

Relationship overview:
- One user can have many friendships, blocks, messages, and matches.
- Conversations support private and group participation via join table.
- Messages belong to a conversation and sender; reactions belong to message + user.

## Features List

Implemented features (samamg):

- Authentication and account lifecycle
	- Register/login/logout/session restore
	- Password hashing
	- Account deletion
- Profile management
	- Update profile data
	- Avatar upload and retrieval
- Social features
	- User search
	- Friend requests + accept/decline/remove
	- Blocking
	- Private/group conversations
	- Group owner transfer and membership management
	- Message replies and reactions
	- Read receipts, typing indicators, unread counters
	- Realtime notifications
- Gameplay
	- Pong local mode
	- Pong practice mode vs AI
	- Pong online mode with matchmaking
	- Server-authoritative simulation and scoring
	- Online disconnect handling and result persistence
- Statistics
	- Profile online match history
	- Wins/losses/win-rate summary
- Tournament
	- 4-player registration
	- Semi-final to final bracket generation
	- Match reporting and winner resolution

## Modules

Chosen modules and point calculation:

1. **Web - Major: Use a framework for frontend and backend** (2 pts)
	 - React frontend + Express backend.
	 - Implemented by: samamg

2. **Web - Major: Real-time features** (2 pts)
	 - Socket.IO realtime updates for gameplay and social.
	 - Implemented by: samamg

3. **Web - Major: User interaction (chat/profile/friends)** (2 pts)
	 - Complete social interaction baseline.
	 - Implemented by: samamg

4. **Web - Minor: ORM** (1 pt)
	 - Prisma used for all DB models/migrations.
	 - Implemented by: samamg

5. **User Management - Major: Standard user management and auth** (2 pts)
	 - Profile updates, avatars, friendship with online awareness, profile page.
	 - Implemented by: samamg

6. **Gaming - Major: Complete web-based game** (2 pts)
	 - Functional Pong with rules and win conditions.
	 - Implemented by: samamg

7. **Gaming - Major: Remote players** (2 pts)
	 - Two remote players, matchmaking, graceful handling.
	 - Implemented by: samamg

8. **Gaming - Minor: Tournament system** (1 pt)
	 - Tournament registration, matchup order, bracket progression, result tracking.
	 - Implemented by: samamg

**Total: 14 points**

## Individual Contributions

samamg delivered all parts of the project:

- Product and architecture decisions.
- Backend API + Socket.IO layer.
- Database schema and migration strategy.
- Frontend UI and gameplay integration.
- Containerization and deployment entrypoint.
- Validation scripts and QA passes.

Main challenges and resolutions:
- Synchronizing online gameplay while avoiding desync.
	- Resolved with server-authoritative game state and controlled broadcast cadence.
- Integrating social realtime with persistent state.
	- Resolved by combining socket events with DB-backed models.
- Ensuring stable profile statistics.
	- Resolved by using authoritative `Match` records for online history.

## Resources

Technical references:
- React docs: https://react.dev
- Express docs: https://expressjs.com
- Prisma docs: https://www.prisma.io/docs
- Socket.IO docs: https://socket.io/docs/v4
- PostgreSQL docs: https://www.postgresql.org/docs
- Nginx docs: https://nginx.org/en/docs

AI usage disclosure:
- AI assistance was used for:
	- Refactoring support
	- Debugging hypotheses and validation checklists
	- Documentation drafting structure
- All generated suggestions were reviewed, tested, and adapted before integration.

## Known Limitations

- HTTPS certificate is self-signed for local deployment.
- Tournament implementation focuses on minimal valid single-elimination scope.

## License

Educational project for 42 curriculum.
