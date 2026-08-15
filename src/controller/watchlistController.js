import { prisma } from "../config/db.connect.js"


const addToWatchList = async (req, res) => {
    const { userId, movieId, status,rating,notes } = req.body

    if(!userId ||!movieId ||!status){
        return res.status(400).json({message:'All fields are required'})    
    }
    const movieExists=await prisma.movie.findUnique({where:{id:movieId}})
    if(!movieExists){
        return res.status(404).json({message:'Movie not found'})
    }
    //check if already added
    const watchListExists=await prisma.watchList.findUnique({where:{userId_movieId:{userId,movieId}}})
    if(watchListExists){
        return res.status(400).json({message:'Movie already added to watch list'})
    }
    const watchList=await prisma.watchList.create({
        data:{userId,movieId,status,rating,notes}
    })
    res.status(201).json({message:'Movie added to watch list',watchList})
}

export default addToWatchList