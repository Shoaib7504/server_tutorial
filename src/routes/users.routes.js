import express from 'express';
import { prisma } from '../config/db.connect.js';

const router = express.Router();

router.get('/', async(req,res)=>{
    try {
        const users = await prisma.user.findMany()
        res.json({message:'Users route',users})
    } catch (error) {
        console.log('Error fetching users',error)
        res.status(500).json({message:'Internal server error'})
    }
})

export default router;
