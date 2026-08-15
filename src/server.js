import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import movieRouter from "./routes/movies.route.js";
import authRouter from "./routes/authRoutes.js";
import { dbConnect, dbClose } from "./config/db.connect.js";
import watchlistRouter from "./routes/addToWatchlist.js";
const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors())

dbConnect()

//routes
app.use('/movies',movieRouter)
app.use('/auth',authRouter)
app.use('/auth',authRouter)
app.use('/auth',authRouter)
app.use('/watchlist',watchlistRouter)

app.get('/',(req,res)=>{
    res.json({message:'Hello World!',
        "success":true,
        "statusCode":200,
        "error":null
    })
})

const server=app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})


// handel unhandled promise rejection (e.g. db error) and call server.close() before exit
process.on('unhandledRejection',async(err)=>{
    console.log('Unhandled Rejection',err)
    server.close(async()=>{
        await dbClose()
        process.exit(1)
    })
})
// handel uncaught exception (e.g. syntax error)
process.on('uncaughtException',async(err)=>{
    console.log('Uncaught Exception',err)
    await dbClose()
    process.exit(1)
})
// graceful shutdown on SIGTERM and SIGINT
process.on('SIGTERM',async()=>{
    console.log('SIGTERM received, shutting down gracefully')
    await dbClose()
    process.exit(0)
})
process.on('SIGINT',async()=>{
    console.log('SIGINT received, shutting down gracefully')
    await dbClose()
    process.exit(0)
})