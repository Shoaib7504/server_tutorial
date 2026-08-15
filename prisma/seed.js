import { PrismaClient } from '../src/generated/prisma/client.ts'
import { PrismaPg } from "@prisma/adapter-pg"
import 'dotenv/config'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const UserId='2e4c0016-53c2-4aa9-b995-38726c55f3c3'
const moviesData = [
            {
                title: "The Shawshank Redemption",
                description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
                releaseYear: 1994,
                duration: 142,
                rating: 9.3,
                genres: ["Drama"],
                imgUrl: "https://example.com/shawshank.jpg",
                userId: UserId
            },
            {
                title: "The Godfather",
                description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
                releaseYear: 1972,
                duration: 175,
                rating: 9.2,
                genres: ["Crime", "Drama"],
                imgUrl: "https://example.com/godfather.jpg",
                userId: UserId
            },
            {
                title: "The Dark Knight",
                description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
                releaseYear: 2008,
                duration: 152,
                rating: 9.0,
                genres: ["Action", "Crime", "Drama"],
                imgUrl: "https://example.com/darkknight.jpg",
                userId: UserId
            }
        ]


const seed = async () => {
    try {


        console.log('Seeding started...')

        // Create movies
        for (const movie of moviesData) {
            await prisma.movie.create({
                data: movie
            })
        }

        console.log('Seeding completed successfully!')
    } catch (error) {
        console.error('Error during seeding:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

seed()