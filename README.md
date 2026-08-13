# Backend Tutorial — Movie Watchlist API

A step-by-step Express 5 + Prisma 7 backend for a movie watchlist app. It has:

- **Authentication** (register / login / logout) with bcrypt password hashing and JWT stored in an httpOnly cookie
- **User & Movie routes** (movies are stubs for now)
- A **Postgres** database via **Prisma ORM 7** (hosted Neon Postgres)

The goal of this README is that **a new developer can read it, write the code themselves, and understand every piece**. Each file below is explained and shown in full.

---

## 1. Tech Stack

| Piece       | What it is |
|-------------|-----------|
| Node.js     | Runtime — **Node ≥ 22.6 required** (we use 24) because Prisma 7 generates TypeScript and Node strips types natively |
| Express 5   | HTTP server / routing framework |
| Prisma 7    | ORM — talks to the database for us |
| Postgres    | Database (Neon hosted instance) |
| bcrypt      | Hash and compare passwords |
| jsonwebtoken | Create JWT tokens for logged-in users |
| dotenv      | Load secrets from `.env` |
| nodemon     | Auto-restarts the server while developing |

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
│   └── migrations/          # SQL migration files (generated)
└── src/
    ├── server.js            # entry point — creates the Express app
    ├── config/
    │   └── db.connect.js    # creates the Prisma client + connect/disconnect
    ├── routes/
    │   ├── authRoutes.js    # /auth/register, /auth/login, /auth/logout
    │   ├── movies.route.js  # /movies CRUD stubs
    │   └── users.routes.js  # /users list (example of a DB route)
    ├── controllers/
    │   └── authController.js # logic for register / login / logout
    └── utils/
        └── generateToken.js # makes a JWT + sets the cookie
```

---

## 3. Setup

### 3.1 Prerequisites

- Node.js **24** (or ≥ 22.6)
- A Postgres database. This project uses a remote Neon Postgres URL.

### 3.2 Install dependencies

```bash
npm init -y
npm install express cors dotenv bcrypt jsonwebtoken @prisma/client @prisma/adapter-pg pg
npm install -D nodemon prisma
```

Then set `"type": "module"` in `package.json` (this project uses ESM `import`).

Scripts in `package.json`:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
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
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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
  createdBy   String?
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  watchLists  WatchList[]
}

model WatchList {
  id String @id @default(cuid())
  userId    Int
  movieId   Int
  status    WatchStatus @default(PLANNED)
  rating    Int?
  notes     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  movie     Movie       @relation(fields: [movieId], references: [id], onDelete: Cascade)
}

enum WatchStatus {
  PLANNED
  WATCHING
  COMPLETED
  DROPPED
}
```

Key points:
- `@id @default(autoincrement())` → integer primary key, auto-incremented
- `@unique` → the email must be unique in the DB
- `?` → optional field
- `String[]` → array of strings (Postgres array column)
- `@updatedAt` → updated automatically whenever the row changes
- `@relation(fields: [...], references: [...])` → foreign key
- `@default(cuid())` → generated string id for the WatchList

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
        res.clearCookie('jwt', {
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

## 8. Routes

Routes tell Express "when this URL + method is hit, run this handler".

### 8.1 Auth routes — `src/routes/authRoutes.js`

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

### 8.2 Movies routes (stubs) — `src/routes/movies.route.js`

Just returns mock JSON for now so you can see the HTTP methods in action.

```js
import express from "express";

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ httpMethod: 'GET', message: 'Movies are here' })
})

// router.get('/:id',(req,res)=>{
//     res.json({message:`Movie with id ${req.params.id} found`})
// })

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

### 8.3 Users route (real DB query example) — `src/routes/users.routes.js`

```js
import express from 'express';
import { prisma } from '../config/db.connect.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const users = await prisma.user.findMany()
        res.json({ message: 'Users route', users })
    } catch (error) {
        console.log('Error fetching users', error)
        res.status(500).json({ message: 'Internal server error' })
    }
})

export default router;
```

---

## 9. Entry point — `src/server.js`

This is where the app is assembled: middleware first, then routes, then listening.

```js
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import movieRouter from "./routes/movies.route.js";
import authRouter from "./routes/authRoutes.js";
import { dbConnect, dbClose } from "./config/db.connect.js";

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())   // parse JSON request bodies → req.body
app.use(cors())           // allow the frontend (different origin) to call this API

dbConnect()

// routes
app.use('/movies', movieRouter)
app.use('/auth', authRouter)

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

> `express.json()` must come **before** the routes, and requests must send the `Content-Type: application/json` header — otherwise `req.body` is `undefined`.

---

## 10. Run it

```bash
npx prisma generate       # first time only (and after schema changes)
npx prisma migrate dev    # first time only — creates tables
npm run dev               # nodemon — auto-reloads on save
```

Check it: open `http://localhost:3000` → `{ "message": "Hello World!" }`.

---

## 11. API Endpoints

| Method | URL             | Body                                    | What it does              |
|--------|-----------------|-----------------------------------------|---------------------------|
| GET    | `/`             | —                                       | Health check              |
| POST   | `/auth/register`| `{ name, email, password }`             | Create account + JWT cookie |
| POST   | `/auth/login`   | `{ email, password }`                   | Log in + JWT cookie       |
| POST   | `/auth/logout`  | —                                       | Clear JWT cookie          |
| GET    | `/users`        | —                                       | List all users (DB)       |
| GET    | `/movies`       | —                                       | Stub: list movies         |
| POST   | `/movies`       | any JSON                                | Stub: add movie           |
| PUT    | `/movies`       | any JSON                                | Stub: update movie        |
| DELETE | `/movies`       | any JSON                                | Stub: delete movie        |

Example login request (REST Client `.http` file):

```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "alex.morgan@example.com",
  "password": "your-real-plain-password"
}
```

> ⚠️ Send the **plain-text password you registered with** — never a hash. Register stores a bcrypt hash; login compares against it.

---

## 12. Common Pitfalls

1. **`req.body` is undefined** → the request is missing `Content-Type: application/json`, or `express.json()` is placed after the routes.
2. **`SASL: client password must be a string`** → `DATABASE_URL` is undefined when the adapter is created. `db.connect.js` must `import 'dotenv/config'` at the top.
3. **`TableDoesNotExist`** → run `npx prisma migrate dev` to create the tables.
4. **Don't follow Prisma v6 tutorials for this project** → it uses Prisma 7: `prisma-client` generator + driver adapter + a TypeScript-generated client imported from `src/generated/prisma/client.ts`.
5. **Login always fails with `401 Invalid password`** → you probably tested with the hashed string, not the real password.
6. **`npm test` errors** → there are no tests configured; verify by running the server instead.
