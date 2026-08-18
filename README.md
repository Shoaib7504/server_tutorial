# Backend Tutorial — Movie Watchlist API

A step-by-step Express 5 + Prisma 7 backend for a movie watchlist app. It has:

- **Authentication** (register / login / logout) with bcrypt password hashing and JWT stored in an httpOnly cookie
- **Protected watchlist routes** — add / update / remove movies, gated by a JWT `authMiddleware`
- **Request validation** with Zod (`validateRequest` middleware + schemas in `src/Validators/`)
- A **Postgres** database via **Prisma ORM 7** (hosted Neon Postgres)
- **Movies routes** (still stubs returning mock JSON for now)

The goal of this README is that **a new developer can read it, write the code themselves, and understand every piece**. Each file below is explained and shown in full.

---

## 1. Tech Stack

| Piece        | What it is |
|--------------|-----------|
| Node.js      | Runtime — **Node ≥ 22.6 required** (we use 24) because Prisma 7 generates TypeScript and Node strips types natively |
| Express 5    | HTTP server / routing framework |
| Prisma 7     | ORM — talks to the database for us |
| Postgres     | Database (Neon hosted instance) |
| bcrypt       | Hash and compare passwords |
| jsonwebtoken | Create JWT tokens for logged-in users |
| cookie-parser| Parse the `jwt` cookie from incoming requests |
| zod          | Define + validate request body schemas |
| dotenv       | Load secrets from `.env` |
| nodemon      | Auto-restarts the server while developing |

---

## 2. Project Structure

```
backend-tutorial/
├── .env                     # secrets (gitignored) — never commit!
├── .gitignore
├── package.json
├── prisma.config.ts         # Prisma CLI config (loads .env + schema path)
├── prisma/
│   ├── schema.prisma        # database models (User, Movie, WatchList)
│   ├── seed.js              # optional demo data
│   └── migrations/          # SQL migration files (generated)
└── src/
    ├── server.js            # entry point — creates the Express app
    ├── config/
    │   └── db.connect.js    # creates the Prisma client + connect/disconnect
    ├── middleware/
    │   ├── authMiddleware.js   # verifies the JWT and loads the user
    │   └── validateRequest.js  # runs a zod schema against req.body
    ├── Validators/
    │   └── watchlistValidators.js  # zod schemas for watchlist routes
    ├── routes/
    │   ├── authRoutes.js       # /auth/register, /auth/login, /auth/logout
    │   ├── movies.route.js     # /movies CRUD stubs
    │   └── addToWatchlist.js   # /watchlist (protected) POST/PATCH/DELETE
    ├── controller/
    │   ├── authController.js   # logic for register / login / logout
    │   └── watchlistController.js  # logic for add/update/remove watchlist
    └── utils/
        └── generateToken.js    # makes a JWT + sets the cookie
```

---

## 3. Setup

### 3.1 Prerequisites

- Node.js **24** (or ≥ 22.6)
- A Postgres database. This project uses a remote Neon Postgres URL.

### 3.2 Install dependencies

```bash
npm init -y
npm install express cors dotenv bcrypt jsonwebtoken cookie-parser zod @prisma/client @prisma/adapter-pg pg
npm install -D nodemon prisma
```

Then set `"type": "module"` in `package.json` (this project uses ESM `import`).

Scripts in `package.json`:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "seed": "node ./prisma/seed.js"
}
```

### 3.3 Create `.env`

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname"
JWT_SECRET="any-long-random-string"
```

> ⚠️ Never commit `.env`. It is already in `.gitignore`.

---

## 4. Database Schema — `prisma/schema.prisma`

Prisma models describe your tables. Three models: `User`, `Movie`, `WatchList`.

```prisma
generator client {
  provider               = "prisma-client"
  output                 = "../src/generated/prisma"
  moduleFormat           = "esm"
  generatedFileExtension = "ts"
  importFileExtension    = "ts"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String      @id @default(uuid())
  name      String
  email     String      @unique
  password  String
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  movies      Movie[]
  watchLists  WatchList[]
}

model Movie {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  releaseYear Int
  duration    Int
  rating      Float    @default(0.0)
  genres      String[] @default([])
  imgUrl      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String? // user email
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  watchLists  WatchList[]
}

model WatchList {
  id        String      @id @default(cuid())
  userId    String
  movieId   Int
  status    WatchStatus @default(PLANNED)
  rating    Int?
  notes     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  movie     Movie       @relation(fields: [movieId], references: [id], onDelete: Cascade)

  @@unique([userId, movieId])
}

enum WatchStatus {
  PLANNED
  WATCHING
  COMPLETED
  DROPPED
}
```

Key points:
- `@id @default(uuid())` → **string** primary key, generated UUID
- `@id @default(autoincrement())` → integer primary key, auto-incremented (movies)
- `@unique` → the email must be unique in the DB
- `?` → optional field
- `String[]` → array of strings (Postgres array column)
- `@updatedAt` → updated automatically whenever the row changes
- `@relation(fields: [...], references: [...])` → foreign key
- `@@unique([userId, movieId])` → a user can have each movie in their watchlist only once
- `enum WatchStatus` → only these 4 values are valid for `status`

### Prisma CLI config — `prisma.config.ts`

Prisma CLI does **not** auto-load `.env`, so the config imports `dotenv/config` and points at your schema + migration folder.

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

### Generate the client and create the tables

```bash
npx prisma generate   # creates the client in src/generated/prisma
npx prisma migrate dev --name init   # creates the tables in the DB
node prisma/seed.js   # optional — inserts demo movies
```

> Prisma 7 writes the client into `src/generated/prisma` (gitignored). Run `npx prisma generate` again after any schema change. Migration files land in `prisma/migrations/`.

---

## 5. Database connection — `src/config/db.connect.js`

**Prisma 7 requires a driver adapter.** Here we use `PrismaPg` from `@prisma/adapter-pg` with your `DATABASE_URL`.

> ⚠️ ESM gotcha: imports run before the rest of the file. `dotenv` must be imported **at the top** (`import 'dotenv/config'`), otherwise `DATABASE_URL` is `undefined` and the first real query fails.

```js
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ?
       [ 'error', 'info', 'warn'] :
        ['error']
})

const dbConnect = async () => {
    try {
        await prisma.$connect()
        console.log('Database connected')
    } catch (error) {
        console.log('Database connection failed', error)
        process.exit(1)
    }
}

const dbClose = async () => {
    try {
        await prisma.$disconnect()
        console.log('Database disconnected')
    } catch (error) {
        console.log('Database disconnection failed', error)
    }
}

export { prisma, dbConnect, dbClose }
```

> Prisma model `WatchList` is accessed in code as `prisma.watchList` (Prisma lowercases the model name for the client accessor).

---

## 6. Token helper — `src/utils/generateToken.js`

Creates a JWT and stores it in an **httpOnly cookie** (safer than localStorage — JS can't read it, so XSS can't steal it).

```js
import jwt from "jsonwebtoken";

const genrateToken = (userId, res) => {
    const payload = { id: userId }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV !== 'development'
    })
    return token
}

export default genrateToken
```

- `expiresIn: '7d'` → token valid for 7 days
- `httpOnly` → not readable by browser JS
- `sameSite: 'strict'` → only sent on same-site requests (CSRF protection)
- `secure` → only send over HTTPS outside development
- The payload is `{ id: userId }` — so when the middleware verifies it, it reads `decoded.id`.

---

## 7. Auth controller — `src/controller/authController.js`

This is the brain of auth. The pattern for every handler: `try/catch`, validate input, talk to the DB via `prisma`, return a JSON response.

```js
import { prisma } from "../config/db.connect.js"
import bcrypt from "bcrypt"
import genrateToken from "../utils/generateToken.js"

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body

        // 1. check if user already exists
        const userExist = await prisma.user.findUnique({ where: { email: email } })
        if (userExist) {
            return res.status(400).json({ message: 'User already exists' })
        }

        // 2. hash password (NEVER store plain text)
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // 3. create new user
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword }
        })

        // 4. generate jwt token + set cookie
        const token = genrateToken(user.id, res)

        // 5. return response
        res.status(201).json({
            success: true,
            statusCode: 201,
            message: 'User registered successfully',
            user,
            token
        })
    } catch (error) {
        console.log("Error during registration", error)
        res.status(500).json({ message: 'Internal server error' })
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' })
        }

        // 1. check the user exists
        const userExist = await prisma.user.findUnique({ where: { email: email } })
        if (!userExist) {
            return res.status(404).json({ message: 'User not found' })
        }

        // 2. compare password with the stored hash
        const isPasswordValid = await bcrypt.compare(password, userExist.password)
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' })
        }

        // 3. generate jwt token + set cookie
        const token = genrateToken(userExist.id, res)

        // 4. return response
        res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'User logged in successfully',
            user: userExist,
            token
        })
    } catch (error) {
        console.log('Error during login', error)
        res.status(500).json({ message: 'Internal server error' })
    }
}

const LogOut = async (req, res) => {
    try {
        res.clearCookie('jwt', '', {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV !== 'development',
            expires: new Date(0)
        })
        res.status(200).json({ message: 'User logged out successfully' })
    } catch (error) {
        console.log('Error during logout', error)
        res.status(500).json({ message: 'Internal server error' })
    }
}

export { register, login, LogOut }
```

Key ideas:
- `bcrypt.hash` on register, `bcrypt.compare` on login — the DB only ever stores a hash.
- A 1:1 mapping between "what happened" and the HTTP status code: `400` bad input, `404` user missing, `401` wrong password, `201` created, `200` ok, `500` server error.
- `req.body` comes from `express.json()` — **the request must send `Content-Type: application/json`**.

---

## 8. Auth middleware — `src/middleware/authMiddleware.js`

Middleware runs **before** a route handler. This one runs on every `/watchlist` request and answers one question: *"is this user logged in?"*

```js
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.connect.js";

export const authMiddleware = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};
```

Key ideas:
- It accepts a token from **either** a `Authorization: Bearer <token>` header **or** the `jwt` cookie (via `cookie-parser`).
- `jwt.verify` with the same `JWT_SECRET` it was signed with. A wrong/expired/tampered token throws → `401`.
- `decoded.id` matches the payload created in `generateToken.js` (`{ id: userId }`).
- On success it sets `req.user = user` and calls `next()` so the route handler can use `req.user.id`.
- `req.cookies?.jwt` uses optional chaining — safe even if `req.cookies` is `undefined` (e.g. `cookie-parser` not wired up).

---

## 9. Request validation — `src/middleware/validateRequest.js`

Instead of hand-checking `req.body` in every handler, define a **zod schema** once and validate with this factory. If validation fails, it flattens all error messages into one string.

```js
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formatted = result.error.format();

      const flatErrors = Object.values(formatted)
        .flat()
        .filter(Boolean)
        .map((err) => err._errors)
        .flat();

      return res.status(400).json({ message: flatErrors.join(", ") });
    }

    next();
  };
};
```

Key ideas:
- `schema.safeParse` returns `{ success: true, data }` or `{ success: false, error }` — no exceptions thrown.
- `result.error.format()` gives a nested object like `{ movieId: { _errors: [...] }, ... }`; we flatten the `_errors` arrays into one joined message.
- On success it just calls `next()` — the route handler then reads `req.body`.

---

## 10. Zod schemas — `src/Validators/watchlistValidators.js`

The schemas describe exactly what a valid request body looks like.

```js
import { z } from "zod";

const AddToWatchlistSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  status: z
    .enum(["PLANNED", "WATCHING", "COMPLETED", "DROPPED"], {
      error: () => ({
        message: "Status must be one of: PLANNED, WATCHING, COMPLETED, DROPPED",
      }),
    })
    .optional(),
  rating: z.coerce
    .number()
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 10")
    .max(10, "Rating must be between 1 and 10")
    .optional(),
  notes: z.string().optional(),
});

export { AddToWatchlistSchema };
```

Key points:
- `movieId` is a **positive integer** — it matches the `Movie.id` column (`Int @id @default(autoincrement())`). `z.coerce.number()` also accepts a numeric string like `"3"`.
- `status` is an enum restricted to the 4 `WatchStatus` values — anything else fails with a clear message.
- `rating` must be an integer between 1 and 10.
- Every field except `movieId` is `.optional()` — the same schema is reused by the update route (`PATCH`), which only sends the fields being changed.

---

## 11. Watchlist controller — `src/controller/watchlistController.js`

Three handlers. They all assume `authMiddleware` already ran, so `req.user.id` is the logged-in user.

```js
import { prisma } from "../config/db.connect.js";

const addToWatchlist = async (req, res) => {
  const { movieId, status, rating, notes } = req.body;

  // Verify movie exists
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });

  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }

  // Check if already added
  const existingInWatchlist = await prisma.watchList.findUnique({
    where: {
      userId_movieId: {
        userId: req.user.id,
        movieId: movieId,
      },
    },
  });

  if (existingInWatchlist) {
    return res.status(400).json({ error: "Movie already in the watchlist" });
  }

  const watchlistItem = await prisma.watchList.create({
    data: {
      userId: req.user.id,
      movieId,
      status: status || "PLANNED",
      rating,
      notes,
    },
  });

  res.status(201).json({
    status: "Success",
    data: { watchlistItem },
  });
};

const updateWatchlistItem = async (req, res) => {
  const { status, rating, notes } = req.body;

  const watchlistItem = await prisma.watchList.findUnique({
    where: { id: req.params.id },
  });

  if (!watchlistItem) {
    return res.status(404).json({ error: "Watchlist item not found" });
  }

  // Ensure only owner can update
  if (watchlistItem.userId !== req.user.id) {
    return res
      .status(403)
      .json({ error: "Not allowed to update this watchlist item" });
  }

  const updateData = {};
  if (status !== undefined) updateData.status = status.toUpperCase();
  if (rating !== undefined) updateData.rating = rating;
  if (notes !== undefined) updateData.notes = notes;

  const updatedItem = await prisma.watchList.update({
    where: { id: req.params.id },
    data: updateData,
  });

  res.status(200).json({
    status: "success",
    data: { watchlistItem: updatedItem },
  });
};

const removeFromWatchlist = async (req, res) => {
  const watchlistItem = await prisma.watchList.findUnique({
    where: { id: req.params.id },
  });

  if (!watchlistItem) {
    return res.status(404).json({ error: "Watchlist item not found" });
  }

  // Ensure only owner can delete
  if (watchlistItem.userId !== req.user.id) {
    return res
      .status(403)
      .json({ error: "Not allowed to update this watchlist item" });
  }

  await prisma.watchList.delete({ where: { id: req.params.id } });

  res.status(200).json({
    status: "success",
    message: "Movie removed from watchlist",
  });
};

export { addToWatchlist, updateWatchlistItem, removeFromWatchlist };
```

Key ideas:
- `userId_movieId` is the generated name for the `@@unique([userId, movieId])` compound key — it's what makes "already in the watchlist" a duplicate row.
- The **ownership check** (`watchlistItem.userId !== req.user.id`) returns `403` so users can't edit/delete other people's entries.
- `status.toUpperCase()` normalizes input like `"planned"` to the enum value `"PLANNED"`.

---

## 12. Routes

Routes tell Express "when this URL + method is hit, run this handler".

### 12.1 Auth routes — `src/routes/authRoutes.js`

```js
import express from 'express';
import { login, LogOut, register } from '../controller/authController.js'

const router = express.Router();

router.post('/register', register)
router.post('/login', login)
router.post('/logout', LogOut)

export default router
```

Mounted at `/auth` in the server, so:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

### 12.2 Movies routes (stubs) — `src/routes/movies.route.js`

Just returns mock JSON for now so you can see the HTTP methods in action.

```js
import express from "express";

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ httpMethod: 'GET', message: 'Movies are here' })
})

router.post('/', (req, res) => {
    res.json({ httpMethod: 'POST', message: 'Movie added', data: req.body })
})

router.put('/', (req, res) => {
    res.json({ httpMethod: 'PUT', message: 'Movie updated', data: req.body })
})

router.delete('/', (req, res) => {
    res.json({ httpMethod: 'DELETE', message: 'Movie deleted', data: req.body })
})

export default router
```

### 12.3 Watchlist routes — `src/routes/addToWatchlist.js`

This is where middleware + validation + controller come together:

```js
import express from "express";
import { addToWatchlist, updateWatchlistItem, removeFromWatchlist } from "../controller/watchlistController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { AddToWatchlistSchema } from "../Validators/watchlistValidators.js";

const router = express.Router();
router.use(authMiddleware)

router.post('/', validateRequest(AddToWatchlistSchema), addToWatchlist);
router.patch('/:id', validateRequest(AddToWatchlistSchema), updateWatchlistItem);
router.delete('/:id', removeFromWatchlist);

export default router
```

Key ideas:
- `router.use(authMiddleware)` protects **every** route below it in one line — no need to repeat it per route.
- Middleware runs **left to right**: `authMiddleware` → `validateRequest` → handler. So the handler can trust that `req.user` exists and `req.body` is valid.
- Mounted at `/watchlist` in the server.

---

## 13. Entry point — `src/server.js`

This is where the app is assembled: middleware first, then routes, then listening.

```js
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import cookieParser from "cookie-parser";
import movieRouter from "./routes/movies.route.js";
import authRouter from "./routes/authRoutes.js";
import watchlistRouter from "./routes/addToWatchlist.js";
import { dbConnect, dbClose } from "./config/db.connect.js";

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())     // parse JSON request bodies → req.body
app.use(cors())             // allow the frontend (different origin) to call this API
app.use(cookieParser())     // parse cookies → req.cookies

dbConnect()

// routes
app.use('/movies', movieRouter)
app.use('/auth', authRouter)
app.use('/watchlist', watchlistRouter)

app.get('/', (req, res) => {
    res.json({
        message: 'Hello World!',
        success: true,
        statusCode: 200,
        error: null
    })
})

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})

// graceful shutdown: close DB before exiting
process.on('unhandledRejection', async (err) => {
    console.log('Unhandled Rejection', err)
    server.close(async () => {
        await dbClose()
        process.exit(1)
    })
})

process.on('uncaughtException', async (err) => {
    console.log('Uncaught Exception', err)
    await dbClose()
    process.exit(1)
})

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully')
    await dbClose()
    process.exit(0)
})

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully')
    await dbClose()
    process.exit(0)
})
```

> `express.json()` must come **before** the routes, and requests must send the `Content-Type: application/json` header — otherwise `req.body` is `undefined`. `cookie-parser` is what makes `req.cookies.jwt` work in the auth middleware.

---

## 14. Run it

```bash
npx prisma generate       # first time only (and after schema changes)
npx prisma migrate dev    # first time only — creates tables
node prisma/seed.js       # optional — demo movies
npm run dev               # nodemon — auto-reloads on save
```

Check it: open `http://localhost:3000` → `{ "message": "Hello World!" }`.

---

## 15. API Endpoints

| Method | URL                       | Auth | Body                                                        | What it does              |
|--------|---------------------------|------|-------------------------------------------------------------|---------------------------|
| GET    | `/`                       | no   | —                                                           | Health check              |
| POST   | `/auth/register`          | no   | `{ name, email, password }`                                 | Create account + JWT cookie |
| POST   | `/auth/login`             | no   | `{ email, password }`                                       | Log in + JWT cookie       |
| POST   | `/auth/logout`            | no   | —                                                           | Clear JWT cookie          |
| POST   | `/watchlist`              | yes  | `{ movieId, status?, rating?, notes? }`                     | Add movie to watchlist    |
| PATCH  | `/watchlist/:id`          | yes  | `{ status?, rating?, notes? }` (any subset)                 | Update a watchlist item (owner only) |
| DELETE | `/watchlist/:id`          | yes  | —                                                           | Remove a watchlist item (owner only) |
| GET    | `/movies`                 | no   | —                                                           | Stub: list movies         |
| POST   | `/movies`                 | no   | any JSON                                                    | Stub: add movie           |
| PUT    | `/movies`                 | no   | any JSON                                                    | Stub: update movie        |
| DELETE | `/movies`                 | no   | any JSON                                                    | Stub: delete movie        |

The protected `/watchlist` routes read the JWT from the `Authorization` header or the `jwt` cookie. Example (REST Client `.http` file):

```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "alex.morgan@example.com",
  "password": "your-real-plain-password"
}
```

```http
POST http://localhost:3000/watchlist
Authorization: Bearer <token-from-login>
Content-Type: application/json

{
  "movieId": 3,
  "status": "PLANNED",
  "rating": 5,
  "notes": "Looking forward to watching this."
}
```

> ⚠️ Send the **plain-text password you registered with** — never a hash. Register stores a bcrypt hash; login compares against it. The token in the login response is what you pass as the Bearer token.

---

## 16. Common Pitfalls

1. **`req.body` is undefined** → the request is missing `Content-Type: application/json`, or `express.json()` is placed after the routes.
2. **`SASL: client password must be a string`** → `DATABASE_URL` is undefined when the adapter is created. `db.connect.js` must `import 'dotenv/config'` at the top.
3. **`TableDoesNotExist`** → run `npx prisma migrate dev` to create the tables.
4. **Don't follow Prisma v6 tutorials for this project** → it uses Prisma 7: `prisma-client` generator + driver adapter + a TypeScript-generated client imported from `src/generated/prisma/client.ts`.
5. **`Invalid input: expected string, received number` from validation** → a zod schema expects the wrong type. `Movie.id` is an `Int`, so `movieId` must validate with `z.coerce.number()` — not `z.string().uuid()`.
6. **Watchlist keeps rejecting with `Movie already in the watchlist`** → the `@@unique([userId, movieId])` compound key is doing its job; you've added that movie already.
7. **`req.cookies` is always empty / `req.cookies?.jwt` never found** → `cookie-parser` is not installed or not added via `app.use(cookieParser())`. The Bearer header still works.
8. **Login always fails with `401 Invalid password`** → you probably tested with the hashed string, not the real password.
9. **`npm test` errors** → there are no tests configured; verify by running the server instead.
