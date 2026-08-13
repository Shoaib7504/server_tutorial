import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ?
       ['query', 'error', 'info', 'warn'] :
        ['error']
})

const dbConnect=async()=>{
    try {
        await prisma.$connect()
        console.log('Database connected')
    } catch (error) {
        console.log('Database connection failed',error)
        process.exit(1)
    }
}



const dbClose=async()=>{
    try {
        await prisma.$disconnect()
        console.log('Database disconnected')
    } catch (error) {
        console.log('Database disconnection failed',error)
    }
}

export {prisma,dbConnect,dbClose}