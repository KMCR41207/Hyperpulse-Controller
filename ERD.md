# HYPERPULSE CONTROLLER — Entity-Relationship Diagram (ERD)

## Database Structure Overview

This ERD defines the complete data model for the Hyperpulse Controller system, including user management, device connections, controller profiles, game configurations, community features, multiplayer sessions, and telemetry logging.

---

## Core Entities

### 1. User
**Primary Entity - User Account Management**
```
user_id         (PK, UUID)          — Unique user identifier
email           (UNIQUE)            — Email address for login/contact
password_hash   (VARCHAR)           — Bcrypt/Argon2 hashed password
name            (VARCHAR)           — Display name
avatar_url      (TEXT)              — Profile picture URL
created_at      (TIMESTAMP)         — Account creation timestamp
updated_at      (TIMESTAMP)         — Last profile update
```
**Relationships:**
- 1:M → Device (user owns multiple devices)
- 1:M → ControllerProfile (user has custom profiles)
- 1:M → GameProfile (user has game-specific configs)
- 1:M → CommunityProfile (user creates community profiles)
- 1:M → CommunityReview (user leaves reviews)
- 1:M → CommunityDownload (user downloads profiles)
- M:M → CommunityFavorite (user bookmarks profiles)
- 1:M → ConnectionSession (user hosts multiplayer sessions)
- 1:1 → Settings (user preferences)

---

### 2. Device
**Mobile Device Registration & Connection Tracking**
```
device_id           (PK, UUID)      — Unique device identifier
user_id             (FK → User)     — Device owner
device_name         (VARCHAR)       — User-defined name (e.g., "Mani's Phone")
os_type             (ENUM)          — iOS / Android / Web
os_version          (VARCHAR)       — OS version string
connection_type     (ENUM)          — USB / Bluetooth / Wi-Fi
battery_level       (INT 0-100)     — Current battery percentage
latency_ms          (FLOAT)         — Measured latency in milliseconds
signal_strength     (ENUM)          — Excellent / Good / Fair / Poor
is_connected        (BOOLEAN)       — Current connection status
last_connected_at   (TIMESTAMP)     — Last successful connection time
paired_at           (TIMESTAMP)     — Initial pairing timestamp
```
**Relationships:**
- M:1 ← User (device belongs to user)
- 1:M → ConnectionSession (device used in sessions)
- 1:M → InputLog (device generates input telemetry)

---

### 3. ControllerProfile
**Custom Controller Layout & Configuration**
```
profile_id          (PK, UUID)      — Unique profile identifier
user_id             (FK → User)     — Profile owner
profile_name        (VARCHAR)       — User-defined name
controller_type     (ENUM)          — gamepad / racing / gyro / mouse / keyboard / custom
layout_json         (JSONB)         — Custom builder layout as JSON
                                      {
                                        "buttons": [
                                          {"id": "btn1", "x": 100, "y": 200, "key": "A"}
                                        ],
                                        "sticks": [
                                          {"id": "stick1", "x": 50, "y": 100, "radius": 40}
                                        ]
                                      }
created_at          (TIMESTAMP)     — Profile creation time
updated_at          (TIMESTAMP)     — Last modification time
is_favorite         (BOOLEAN)       — User-marked favorite
```
**Relationships:**
- M:1 ← User (profile belongs to user)
- M:M ← GameProfile (profile used in game configs)

---

### 4. GameProfile
**Game-Specific Controller Mapping & Configuration**
```
game_profile_id         (PK, UUID)      — Unique game profile ID
user_id                 (FK → User)     — Profile owner
game_name               (VARCHAR)       — Game title (e.g., "Fortnite", "Gran Turismo")
game_icon_url           (TEXT)          — Game cover/icon image URL
recommended_controller_type (ENUM)      — Default mode for this game
button_mapping_json     (JSONB)         — Custom key mappings
                                          {
                                            "A": "SPACEBAR",
                                            "B": "C",
                                            "X": "SHIFT",
                                            "Y": "Q",
                                            "L1": "TAB",
                                            "R1": "E"
                                          }
created_at              (TIMESTAMP)     — Creation timestamp
updated_at              (TIMESTAMP)     — Last modification
```
**Relationships:**
- M:1 ← User (game profile belongs to user)
- M:M ← ControllerProfile (uses custom profiles)

---

### 5. CommunityProfile
**Shared Community-Created Controller Profiles**
```
community_profile_id    (PK, UUID)      — Unique community profile ID
user_id                 (FK → User)     — Creator user ID
profile_name            (VARCHAR)       — Profile display name
game_name               (VARCHAR)       — Associated game
controller_type         (ENUM)          — Profile type
description             (TEXT)          — Detailed description
layout_json             (JSONB)         — Profile layout configuration
tags                    (JSONB ARRAY)   — Search tags (e.g., ["FPS", "Pro", "Sensitivity-High"])
download_count          (INT)           — Total downloads
average_rating          (FLOAT 1-5)     — Average user rating
is_public               (BOOLEAN)       — Public/private visibility
created_at              (TIMESTAMP)     — Upload date
updated_at              (TIMESTAMP)     — Last edit date
```
**Relationships:**
- M:1 ← User (created by user)
- 1:M → CommunityReview (receives reviews)
- 1:M → CommunityDownload (tracks downloads)
- M:M ← CommunityFavorite (bookmarked by users)

---

### 6. CommunityReview
**User Reviews & Ratings for Community Profiles**
```
review_id               (PK, UUID)      — Unique review ID
community_profile_id    (FK → CommunityProfile) — Reviewed profile
user_id                 (FK → User)     — Reviewer
rating                  (INT 1-5)       — Star rating
comment_text            (TEXT)          — Review comment
created_at              (TIMESTAMP)     — Review submission date
```
**Relationships:**
- M:1 ← CommunityProfile (review for profile)
- M:1 ← User (reviewer)

---

### 7. CommunityDownload
**Download History & Statistics Tracking**
```
download_id             (PK, UUID)      — Unique download record ID
community_profile_id    (FK → CommunityProfile) — Downloaded profile
user_id                 (FK → User)     — User who downloaded
downloaded_at           (TIMESTAMP)     — Download timestamp
```
**Relationships:**
- M:1 ← CommunityProfile (profile being downloaded)
- M:1 ← User (user downloading)

---

### 8. CommunityFavorite
**User's Bookmarked Community Profiles**
```
favorite_id             (PK, UUID)      — Unique bookmark record
user_id                 (FK → User)     — User bookmarking
community_profile_id    (FK → CommunityProfile) — Bookmarked profile
added_at                (TIMESTAMP)     — Bookmark creation time
```
**Relationships:**
- M:1 ← User (user's favorite)
- M:1 ← CommunityProfile (favorited profile)

---

### 9. ConnectionSession
**Multiplayer Room Management**
```
session_id              (PK, UUID)      — Unique session ID
host_user_id            (FK → User)     — Session host
session_code            (VARCHAR 10)    — Human-readable code (e.g., "HYPER-4821")
max_players             (INT)           — Maximum players (default 4)
current_players         (INT)           — Active player count
created_at              (TIMESTAMP)     — Session start time
expires_at              (TIMESTAMP)     — Session expiration
status                  (ENUM)          — active / ended / paused
```
**Relationships:**
- M:1 ← User (hosted by user)
- 1:M → SessionPlayer (players in session)

---

### 10. SessionPlayer
**Individual Player Tracking Within Sessions**
```
player_id               (PK, UUID)      — Unique player slot ID
session_id              (FK → ConnectionSession) — Session reference
user_id                 (FK → User)     — Player user
device_id               (FK → Device)   — Player's device
player_number           (INT 1-4)       — Player slot number
current_controller_type (ENUM)          — Active controller mode
signal_quality          (INT 0-100)     — Connection quality percentage
joined_at               (TIMESTAMP)     — Player join time
```
**Relationships:**
- M:1 ← ConnectionSession (player in session)
- M:1 ← User (player user account)
- M:1 ← Device (player's device)

---

### 11. InputLog
**Telemetry & Debug Input Recording**
```
log_id                  (PK, UUID)      — Unique log entry ID
device_id               (FK → Device)   — Logging device
session_id              (FK → ConnectionSession, nullable) — Associated session
input_type              (ENUM)          — button / stick / gyro / mouse / keyboard / trigger
value_json              (JSONB)         — Input data
                                          For stick: {"x": 0.5, "y": -0.2}
                                          For button: {"pressed": true}
                                          For gyro: {"pitch": 10.5, "roll": -5.2, "yaw": 0}
timestamp               (TIMESTAMP)     — Exact input timestamp
latency_ms              (FLOAT)         — Measured latency
```
**Relationships:**
- M:1 ← Device (device sending input)
- M:1 ← ConnectionSession (session context)

---

### 12. Settings
**Per-User Configuration & Preferences**
```
setting_id              (PK, UUID)      — Unique settings record
user_id                 (FK → User, UNIQUE) — User (one-to-one)
theme                   (ENUM)          — dark / light / amoled
accent_color            (VARCHAR 7)     — Hex color code (e.g., "#cc1111")
button_sensitivity      (INT 1-10)      — Button response curve
joystick_sensitivity    (INT 1-10)      — Analog stick speed
dead_zone_percent       (INT 0-30)      — Stick dead zone percentage
gyro_sensitivity        (INT 1-10)      — Gyroscope response scale
haptic_enabled          (BOOLEAN)       — Vibration feedback
auto_reconnect          (BOOLEAN)       — Auto-reconnect on drop
updated_at              (TIMESTAMP)     — Last preference change
```
**Relationships:**
- 1:1 ← User (user's settings)

---

## Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER                                    │
│  (user_id, email, password_hash, name, avatar_url, ...)        │
└──────────┬──────────────────────────────────────────────────────┘
           │
     ┌─────┼─────┬──────────┬───────────────┬──────────┬─────────┐
     │     │     │          │               │          │         │
    1:M   1:M   1:M        1:M             1:M        1:M       1:1
     │     │     │          │               │          │         │
┌────▼──┐ ┌──────▼─────┐ ┌───▼──────────┐ ┌───▼─────────┐ ┌─────▼────┐
│DEVICE │ │CONTROLLER  │ │GAME PROFILE  │ │COMMUNITY    │ │SETTINGS  │
│       │ │PROFILE     │ │              │ │PROFILE      │ │          │
└────┬──┘ └──────┬─────┘ └───┬──────────┘ └───┬─────────┘ └──────────┘
    1:M        M:M            M:M             │ (1:M)
     │          │              │              │
     │      ┌────▼────┐         │         ┌────▼───────────┐
     │      │          │         │         │                │
     │      └──────────┘         │     1:M │    1:M        │
     │                           │     ┌───▼──────┐  ┌─────▼──────┐
     │                           │     │COMMUNITY │  │COMMUNITY   │
     │                           │     │REVIEW    │  │DOWNLOAD    │
     │                           │     └──────────┘  └────────────┘
     │                           │
     │                           │ M:M
     │                       ┌───▼──────────────┐
     │                       │COMMUNITY FAVORITE│
     │                       └──────────────────┘
     │
     │ 1:M
     │        ┌──────────────────────┐
     │        │CONNECTION SESSION    │
     │        │(host_user_id)        │
     │        └──────────┬───────────┘
     │                  1:M
     │            ┌──────▼────────┐
     └──────►M:1──┤SESSION PLAYER │
                   └──────┬────────┘
                         M:1
                          │
                      ┌───▼─────┐
                      │INPUT LOG │
                      └──────────┘
```

---

## Key Design Patterns

### 1. **M:M Relationships**
- **ControllerProfile ↔ GameProfile:** A game can use multiple controller profiles; a profile can apply to multiple games.
- **User ↔ CommunityFavorite:** Enables bookmarking without modifying CommunityProfile directly.

### 2. **Hierarchical Sessions**
- **ConnectionSession → SessionPlayer:** Enables multiplayer tracking, signal monitoring per player, and per-device latency measurement.

### 3. **Telemetry & Logging**
- **InputLog:** Records raw input events with timestamps and latency for debugging and performance analysis.
- Links optionally to sessions for contextual debugging.

### 4. **Community Ecosystem**
- **CommunityProfile + CommunityReview + CommunityDownload:** Full feedback loop for community sharing.
- **CommunityFavorite:** Separate table for user bookmarks (avoids modifying CommunityProfile).

### 5. **Device Tracking**
- Each device is separately registered with connection metadata.
- Enables multi-device support and per-device telemetry.

---

## Indexing Strategy

```sql
-- Performance-critical indexes
CREATE INDEX idx_user_email ON User(email);
CREATE INDEX idx_device_user_id ON Device(user_id);
CREATE INDEX idx_controller_profile_user_id ON ControllerProfile(user_id);
CREATE INDEX idx_game_profile_user_id ON GameProfile(user_id);
CREATE INDEX idx_community_profile_user_id ON CommunityProfile(user_id);
CREATE INDEX idx_community_profile_game_name ON CommunityProfile(game_name);
CREATE INDEX idx_community_review_profile_id ON CommunityReview(community_profile_id);
CREATE INDEX idx_community_download_profile_id ON CommunityDownload(community_profile_id);
CREATE INDEX idx_community_favorite_user_id ON CommunityFavorite(user_id);
CREATE INDEX idx_connection_session_host ON ConnectionSession(host_user_id);
CREATE INDEX idx_session_player_session_id ON SessionPlayer(session_id);
CREATE INDEX idx_session_player_user_id ON SessionPlayer(user_id);
CREATE INDEX idx_input_log_device_id ON InputLog(device_id);
CREATE INDEX idx_input_log_session_id ON InputLog(session_id);
CREATE INDEX idx_settings_user_id ON Settings(user_id);
```

---

## SQL Schema Example (PostgreSQL)

```sql
-- UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Table
CREATE TABLE "User" (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device Table
CREATE TABLE Device (
  device_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  device_name VARCHAR(100),
  os_type VARCHAR(20),
  os_version VARCHAR(20),
  connection_type VARCHAR(20),
  battery_level INT DEFAULT 100,
  latency_ms FLOAT DEFAULT 0,
  signal_strength VARCHAR(20),
  is_connected BOOLEAN DEFAULT FALSE,
  last_connected_at TIMESTAMP,
  paired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ControllerProfile Table
CREATE TABLE ControllerProfile (
  profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  profile_name VARCHAR(100),
  controller_type VARCHAR(50),
  layout_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_favorite BOOLEAN DEFAULT FALSE
);

-- GameProfile Table
CREATE TABLE GameProfile (
  game_profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  game_name VARCHAR(150),
  game_icon_url TEXT,
  recommended_controller_type VARCHAR(50),
  button_mapping_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CommunityProfile Table
CREATE TABLE CommunityProfile (
  community_profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  profile_name VARCHAR(150),
  game_name VARCHAR(150),
  controller_type VARCHAR(50),
  description TEXT,
  layout_json JSONB,
  tags JSONB,
  download_count INT DEFAULT 0,
  average_rating FLOAT DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CommunityReview Table
CREATE TABLE CommunityReview (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_profile_id UUID NOT NULL REFERENCES CommunityProfile(community_profile_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CommunityDownload Table
CREATE TABLE CommunityDownload (
  download_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_profile_id UUID NOT NULL REFERENCES CommunityProfile(community_profile_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CommunityFavorite Table
CREATE TABLE CommunityFavorite (
  favorite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  community_profile_id UUID NOT NULL REFERENCES CommunityProfile(community_profile_id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, community_profile_id)
);

-- ConnectionSession Table
CREATE TABLE ConnectionSession (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  session_code VARCHAR(20) UNIQUE,
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active'
);

-- SessionPlayer Table
CREATE TABLE SessionPlayer (
  player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES ConnectionSession(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES Device(device_id) ON DELETE CASCADE,
  player_number INT,
  current_controller_type VARCHAR(50),
  signal_quality INT DEFAULT 100,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- InputLog Table
CREATE TABLE InputLog (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES Device(device_id) ON DELETE CASCADE,
  session_id UUID REFERENCES ConnectionSession(session_id) ON DELETE CASCADE,
  input_type VARCHAR(50),
  value_json JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  latency_ms FLOAT
);

-- Settings Table
CREATE TABLE Settings (
  setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'dark',
  accent_color VARCHAR(7) DEFAULT '#cc1111',
  button_sensitivity INT DEFAULT 5,
  joystick_sensitivity INT DEFAULT 5,
  dead_zone_percent INT DEFAULT 5,
  gyro_sensitivity INT DEFAULT 5,
  haptic_enabled BOOLEAN DEFAULT TRUE,
  auto_reconnect BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Usage Guide for ChatGPT Prompting

**When giving this ERD to ChatGPT, use prompts like:**

1. **For Backend Development:**
   > "Based on this ERD for Hyperpulse Controller, generate TypeScript/Node.js models using Prisma or Sequelize. Include all relationships, validations, and API endpoints for user authentication, device management, controller profiles, and community features."

2. **For Database Schema:**
   > "Design a SQL schema from this ERD with proper indexing, foreign keys, cascading deletes, and migration files. Include performance optimization tips for large-scale community profile queries."

3. **For Frontend State Management:**
   > "Given this ERD, design a Redux/Zustand store structure for managing user data, device connections, controller profiles, game configs, and community downloads with efficient caching strategies."

4. **For API Design:**
   > "Create RESTful API endpoints from this ERD covering authentication, device pairing, profile CRUD, game mapping, community browsing, reviews, and multiplayer session management."

5. **For Real-time Features:**
   > "Design a WebSocket/Firebase Realtime strategy for InputLog telemetry, ConnectionSession state synchronization, and multi-player latency monitoring."

---

## Notes

- All IDs use **UUID v4** for scalability and distributed system support.
- **Timestamps** use UTC format (CURRENT_TIMESTAMP in PostgreSQL).
- **JSON fields** (layout_json, button_mapping_json, value_json) allow flexible schema evolution.
- **Cascade delete** on user deletion removes all related data automatically.
- **Indexing** focuses on foreign keys, search fields, and frequently queried columns.
- **Community features** use separate download/review/favorite tables for clean separation of concerns.

